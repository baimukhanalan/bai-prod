import assert from 'node:assert/strict';
import test from 'node:test';
import { nextOnboardingStep, onboardingPrompts } from './onboarding.js';

test('asks networking give and seek questions before completing onboarding', () => {
  assert.equal(nextOnboardingStep.goal, 'give');
  assert.equal(nextOnboardingStep.give, 'seek');
  assert.equal(nextOnboardingStep.seek, 'completed');
  assert.match(onboardingPrompts.give, /можешь дать/i);
  assert.match(onboardingPrompts.seek, /ищешь/i);
});
