/*
 * Copyright 2026, Salesforce, Inc.
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

export type CI =
    | 'circleci'
    | 'travisci'
    | 'bitbucket'
    | 'hudson'
    | 'heroku'
    | 'codebuild'
    | 'bamboo'
    | 'cirrus'
    | 'jenkins'
    | 'github_actions'
    | 'azure_pipelines'
    | 'teamcity'
    | 'gitlab'
    | 'nevercode'
    | 'wercker'
    | 'buildkite'
    | 'semaphore'
    | 'bitrise'
    | 'buddy'
    | 'appveyor'
    | 'copado'
    | 'unknown';

// eslint-disable-next-line complexity
export const guessCISystem = (): CI | undefined => {
    const keys = Object.keys(process.env);
    if (keys.find((key) => key.startsWith('CIRCLE'))) {
        return 'circleci';
    }
    if (keys.find((key) => key.startsWith('TRAVIS'))) {
        return 'travisci';
    }
    if (keys.find((key) => key.startsWith('BITBUCKET'))) {
        return 'bitbucket';
    }
    if (keys.find((key) => key.startsWith('CIRRUS'))) {
        return 'cirrus';
    }
    if (keys.find((key) => key.startsWith('HEROKU_TEST_RUN_ID'))) {
        return 'heroku';
    }
    if (keys.find((key) => key.startsWith('bamboo') || key.startsWith('BAMBOO'))) {
        return 'bamboo';
    }
    if (keys.find((key) => key.startsWith('CODEBUILD'))) {
        return 'codebuild';
    }
    if (keys.find((key) => key.startsWith('GITHUB_ACTION'))) {
        return 'github_actions';
    }
    if (keys.find((key) => key.startsWith('AGENT_NAME')) ?? keys.find((key) => key.startsWith('BUILD_BUILDNUMBER'))) {
        return 'azure_pipelines';
    }
    if (keys.find((key) => key.startsWith('TEAMCITY'))) {
        return 'teamcity';
    }
    if (keys.find((key) => key.startsWith('GITLAB'))) {
        return 'gitlab';
    }
    if (keys.find((key) => key.startsWith('NEVERCODE'))) {
        return 'nevercode';
    }
    if (keys.find((key) => key.startsWith('WERCKER'))) {
        return 'wercker';
    }
    if (keys.find((key) => key.startsWith('BUILDKITE'))) {
        return 'buildkite';
    }
    if (keys.find((key) => key.startsWith('SEMAPHORE'))) {
        return 'semaphore';
    }
    if (keys.find((key) => key.startsWith('BITRISE'))) {
        return 'bitrise';
    }
    if (keys.find((key) => key.startsWith('BUDDY'))) {
        return 'buddy';
    }
    if (keys.find((key) => key.startsWith('APPVEYOR'))) {
        return 'appveyor';
    }
    if (keys.find((key) => key.startsWith('JENKINS'))) {
        return 'jenkins';
    }
    if (keys.find((key) => key.startsWith('HUDSON'))) {
        return 'hudson';
    }
    if (keys.find((key) => key.startsWith('CF_SF_') || key.startsWith('COPADO_CI'))) {
        return 'copado';
    }
    if (keys.find((key) => key === 'CI' || key === 'CONTINUOUS_INTEGRATION' || key === 'BUILD_ID')) {
        return 'unknown';
    }
};
