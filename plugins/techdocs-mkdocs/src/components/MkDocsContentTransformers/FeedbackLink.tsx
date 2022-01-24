/*
 * Copyright 2022 The Backstage Authors
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

import React from 'react';
import parseGitUrl from 'git-url-parse';

import { Portal } from '@material-ui/core';
import FeedbackOutlinedIcon from '@material-ui/icons/FeedbackOutlined';

import { useApi } from '@backstage/core-plugin-api';
import { replaceGitHubUrlType } from '@backstage/integration';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import { useTechDocsShadowDom } from '@backstage/plugin-techdocs';

export const FeedbackLinkTransformer = () => {
  const dom = useTechDocsShadowDom();
  const scmIntegrationsApi = useApi(scmIntegrationsApiRef);

  // attempting to use selectors that are more likely to be static as MkDocs updates over time
  const sourceAnchor = dom.querySelector(
    '[title="Edit this page"]',
  ) as HTMLAnchorElement;

  // don't show if edit link not available in raw page
  if (!sourceAnchor || !sourceAnchor.href) {
    return null;
  }

  const sourceURL = new URL(sourceAnchor.href);
  const integration = scmIntegrationsApi.byUrl(sourceURL);

  // don't show if can't identify edit link hostname as a gitlab/github hosting
  if (integration?.type !== 'github' && integration?.type !== 'gitlab') {
    return null;
  }

  // topmost h1 only contains title for whole page
  const title = (dom.querySelector('article>h1') as HTMLElement).childNodes[0]
    .textContent;
  const issueTitle = encodeURIComponent(`Documentation Feedback: ${title}`);
  const issueDesc = encodeURIComponent(
    `Page source:\n${sourceAnchor.href}\n\nFeedback:`,
  );

  // Convert GitHub edit url to blob type so it can be parsed by git-url-parse correctly
  const gitUrl =
    integration?.type === 'github'
      ? replaceGitHubUrlType(sourceURL.href, 'blob')
      : sourceURL.href;
  const gitInfo = parseGitUrl(gitUrl);
  const repoPath = `/${gitInfo.organization}/${gitInfo.name}`;

  const feedbackLink = sourceAnchor.cloneNode() as HTMLAnchorElement;
  if (integration?.type === 'github') {
    feedbackLink.href = `${sourceURL.origin}${repoPath}/issues/new?title=${issueTitle}&body=${issueDesc}`;
  } else {
    feedbackLink.href = `${sourceURL.origin}${repoPath}/issues/new?issue[title]=${issueTitle}&issue[description]=${issueDesc}`;
  }

  feedbackLink.id = 'git-feedback-link';
  feedbackLink.title = 'Leave feedback for this page';
  feedbackLink.style.paddingLeft = '5px';

  sourceAnchor?.insertAdjacentElement('beforebegin', feedbackLink);

  return (
    <Portal container={feedbackLink}>
      <FeedbackOutlinedIcon />
    </Portal>
  );
};
