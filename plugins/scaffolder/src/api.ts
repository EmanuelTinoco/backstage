/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  createApiRef,
  DiscoveryApi,
  Observable,
  IdentityApi,
} from '@backstage/core';
import ObservableImpl from 'zen-observable';
import { ScaffolderTask, Status } from './types';

export const scaffolderApiRef = createApiRef<ScaffolderApi>({
  id: 'plugin.scaffolder.service',
  description: 'Used to make requests towards the scaffolder backend',
});

export type LogEvent = {
  type: 'log' | 'completion';
  body: {
    message: string;
    stepId?: string;
    status?: Status;
  };
  createdAt: string;
  id: string;
  taskId: string;
};

export interface ScaffolderApi {
  /**
   * Executes the scaffolding of a component, given a template and its
   * parameter values.
   *
   * @param templateName Name of the Template entity for the scaffolder to use. New project is going to be created out of this template.
   * @param values Parameters for the template, e.g. name, description
   */
  scaffold(templateName: string, values: Record<string, any>): Promise<string>;

  getTask(taskId: string): Promise<ScaffolderTask>;

  streamLogs({
    taskId,
    after,
  }: {
    taskId: string;
    after?: number;
  }): Observable<LogEvent>;
}
export class ScaffolderClient implements ScaffolderApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.identityApi = options.identityApi;
  }

  /**
   * Executes the scaffolding of a component, given a template and its
   * parameter values.
   *
   * @param templateName Template name for the scaffolder to use. New project is going to be created out of this template.
   * @param values Parameters for the template, e.g. name, description
   */
  async scaffold(
    templateName: string,
    values: Record<string, any>,
  ): Promise<string> {
    const token = await this.identityApi.getIdToken();
    const url = `${await this.discoveryApi.getBaseUrl('scaffolder')}/v2/tasks`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ templateName, values: { ...values } }),
    });

    if (response.status !== 201) {
      const status = `${response.status} ${response.statusText}`;
      const body = await response.text();
      throw new Error(`Backend request failed, ${status} ${body.trim()}`);
    }

    const { id } = (await response.json()) as { id: string };
    return id;
  }

  async getTask(taskId: string) {
    const token = await this.identityApi.getIdToken();
    const baseUrl = await this.discoveryApi.getBaseUrl('scaffolder');
    const url = `${baseUrl}/v2/tasks/${encodeURIComponent(taskId)}`;
    return fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(x => x.json());
  }

  streamLogs({
    taskId,
    after,
  }: {
    taskId: string;
    after?: number;
  }): Observable<LogEvent> {
    return new ObservableImpl(subscriber => {
      const params = new URLSearchParams();
      if (after !== undefined) {
        params.set('after', String(Number(after)));
      }

      this.discoveryApi.getBaseUrl('scaffolder').then(
        baseUrl => {
          const url = `${baseUrl}/v2/tasks/${encodeURIComponent(
            taskId,
          )}/eventstream`;
          const eventSource = new EventSource(url);
          eventSource.addEventListener('log', (event: any) => {
            if (event.data) {
              try {
                subscriber.next(JSON.parse(event.data));
              } catch (ex) {
                subscriber.error(ex);
              }
            }
          });
          eventSource.addEventListener('completion', (event: any) => {
            if (event.data) {
              try {
                subscriber.next(JSON.parse(event.data));
              } catch (ex) {
                subscriber.error(ex);
              }
            }
            subscriber.complete();
          });
          eventSource.addEventListener('error', event => {
            subscriber.error(event);
          });
        },
        error => {
          subscriber.error(error);
        },
      );
    });
  }
}
