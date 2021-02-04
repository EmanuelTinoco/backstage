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

import { DateTime } from 'luxon';
import goodMorning from './locales/goodMorning.locales.json';
import goodAfternoon from './locales/goodAfternoon.locales.json';
import goodEvening from './locales/goodEvening.locales.json';

/**
 * Validates that a date is a valid ISO string.
 *
 * @param date A date string
 * @returns {bool} Whether the date is valid or not.
 */
export function isValidDate(date) {
  return DateTime.fromISO(date).isValid;
}

/**
 * Validates that a date is a valid ISO string and a specific format.
 *
 * @param date A date string
 * @param format A format string to validate against. See https://moment.github.io/luxon/docs/manual/parsing.html#table-of-tokens for reference.
 * @returns {bool} Whether the date is valid or not according to the format.
 */
export function isValidDateAndFormat(date, format) {
  return DateTime.fromFormat(date, format).isValid;
}

export function relativeTime(timestamp) {
  return DateTime.fromISO(timestamp).toRelative();
}

// Select a large random integer at startup, to prevent the greetings to change every time the user
// navigates.
const greetingRandomSeed = Math.floor(Math.random() * 1000000);

export function getTimeBasedGreeting() {
  const random = array => array[greetingRandomSeed % array.length];

  const currentHour = new Date(Date.now()).getHours();
  if (currentHour >= 23) {
    return {
      language: 'Seriously',
      greeting: 'Get some rest',
    };
  }
  const timeOfDay = hour => {
    if (hour < 12) return goodMorning;
    if (hour < 17) return goodAfternoon;
    return goodEvening;
  };
  const greetings = timeOfDay(currentHour);
  const greetingsKey = random(Object.keys(greetings));
  return {
    language: greetingsKey,
    greeting: greetings[greetingsKey],
  };
}
