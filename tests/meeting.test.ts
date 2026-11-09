import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meetingService, parseMeetingLink } from '../lib/meeting';

test('Zoom and Google Meet links are accepted and tidied to https', () => {
  assert.deepEqual(parseMeetingLink(' https://zoom.us/j/1234567890?pwd=abc '), { ok: true, link: 'https://zoom.us/j/1234567890?pwd=abc' });
  assert.deepEqual(parseMeetingLink('us02web.zoom.us/my/maya'), { ok: true, link: 'https://us02web.zoom.us/my/maya' });
  assert.deepEqual(parseMeetingLink('http://meet.google.com/abc-defg-hij'), { ok: true, link: 'https://meet.google.com/abc-defg-hij' });
});

test('anything else is refused with a reason', () => {
  for (const raw of ['https://example.com/meet', 'https://zoom.us.evil.com/j/1', 'https://notzoom.us/j/1', 'not a link at all']) {
    const result = parseMeetingLink(raw);
    assert.equal(result.ok, false, raw);
  }
});

test('the service is named for the Join button', () => {
  assert.equal(meetingService('https://zoom.us/j/1'), 'Zoom');
  assert.equal(meetingService('https://us02web.zoom.us/my/maya'), 'Zoom');
  assert.equal(meetingService('https://meet.google.com/abc-defg-hij'), 'Google Meet');
  assert.equal(meetingService('https://example.com'), null);
});
