/*
 * Copyright 2021 The Backstage Authors
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

import { useNavigate } from 'react-router-dom';
import { useTechDocsShadowDom } from '@backstage/plugin-techdocs';

export const LinkClickTransformer = () => {
  const dom = useTechDocsShadowDom();
  const navigate = useNavigate();

  const baseUrl = window.location.origin;
  const onClick = (event: MouseEvent, url: string) => {
    const { pathname: name, hash } = new URL(url);
    const path = name.concat(hash);

    // detect if CTRL or META keys are pressed so that links can be opened in a new tab with `window.open`
    if (event.ctrlKey || event.metaKey) {
      window.open(path, '_blank');
      return;
    }

    navigate(path);
  };

  Array.from(dom.getElementsByTagName('a')).forEach(elem => {
    elem.addEventListener('click', (e: MouseEvent) => {
      const target = elem as HTMLAnchorElement;
      const href = target.getAttribute('href');
      const download = target.hasAttribute('download');

      if (!href || !download) return;
      if (href.startsWith(baseUrl)) {
        e.preventDefault();
        onClick(e, href);
      }
    });
  });

  return null;
};
