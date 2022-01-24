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

import { useAsync } from 'react-use';
import { useApi } from '@backstage/core-plugin-api';
import {
  techdocsStorageApiRef,
  useTechDocsReader,
  useTechDocsShadowDom,
} from '@backstage/plugin-techdocs';

/**
 * TechDocs backend serves SVGs with text/plain content-type for security. This
 * helper determines if an SVG is being loaded from the backend, and thus needs
 * inlining to be displayed properly.
 */
const isSvgNeedingInlining = (
  attrName: string,
  attrVal: string,
  apiOrigin: string,
) => {
  const isSrcToSvg = attrName === 'src' && attrVal.endsWith('.svg');
  const isRelativeUrl = !attrVal.match(/^([a-z]*:)?\/\//i);
  const pointsToOurBackend = attrVal.startsWith(apiOrigin);
  return isSrcToSvg && (isRelativeUrl || pointsToOurBackend);
};

export const BaseUrlTransformer = () => {
  const dom = useTechDocsShadowDom();
  const { path, entityName } = useTechDocsReader();
  const techdocsStorageApi = useApi(techdocsStorageApiRef);

  useAsync(async () => {
    const apiOrigin = await techdocsStorageApi.getApiOrigin();

    const updateDom = async <T extends Element>(
      list: HTMLCollectionOf<T> | NodeListOf<T>,
      attributeName: string,
    ) => {
      for (const elem of list) {
        if (elem.hasAttribute(attributeName)) {
          const elemAttribute = elem.getAttribute(attributeName);
          if (!elemAttribute) return;

          const newValue = await techdocsStorageApi.getBaseUrl(
            elemAttribute,
            entityName,
            path,
          );

          // Special handling for SVG images.
          if (isSvgNeedingInlining(attributeName, elemAttribute, apiOrigin)) {
            try {
              const svg = await fetch(newValue, { credentials: 'include' });
              const svgContent = await svg.text();
              elem.setAttribute(
                attributeName,
                `data:image/svg+xml;base64,${btoa(svgContent)}`,
              );
            } catch (e) {
              elem.setAttribute('alt', `Error: ${elemAttribute}`);
            }
          } else {
            elem.setAttribute(attributeName, newValue);
          }
        }
      }
    };

    await Promise.all([
      updateDom<HTMLImageElement>(dom.querySelectorAll('img'), 'src'),
      updateDom<HTMLScriptElement>(dom.querySelectorAll('script'), 'src'),
      updateDom<HTMLSourceElement>(dom.querySelectorAll('source'), 'src'),
      updateDom<HTMLLinkElement>(dom.querySelectorAll('link'), 'href'),
      updateDom<HTMLAnchorElement>(dom.querySelectorAll('a[download]'), 'href'),
    ]);
  }, [dom]);

  return null;
};
