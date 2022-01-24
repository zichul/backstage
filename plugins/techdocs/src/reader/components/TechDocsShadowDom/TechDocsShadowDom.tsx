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

import React, {
  ReactElement,
  cloneElement,
  PropsWithChildren,
  useCallback,
} from 'react';

import DOMPurify from 'dompurify';

import { TechDocsShadowDomProvider } from './context';

type SanitizeParameters = Parameters<typeof DOMPurify.sanitize>;
export type TechDocsShadowDomSource = SanitizeParameters[0];
export type TechDocsShadowDomConfig = SanitizeParameters[1];

type AddHookParameters = Parameters<typeof DOMPurify.addHook>;
type HookName = AddHookParameters[0];
type HookCallback = AddHookParameters[1];
export type TechDocsShadowDomHooks = Partial<Record<HookName, HookCallback>>;

type TechDocsShadowDomProps = PropsWithChildren<{
  host: ReactElement;
  source: TechDocsShadowDomSource;
  config: TechDocsShadowDomConfig;
  hooks?: TechDocsShadowDomHooks;
  onAttached?: (shadowRoot: ShadowRoot) => void;
}>;

export const TechDocsShadowDom = ({
  host,
  source,
  config,
  hooks = {},
  children,
  onAttached = () => {},
}: TechDocsShadowDomProps) => {
  for (const [name, callback] of Object.entries(hooks)) {
    DOMPurify.addHook(name as HookName, callback);
  }

  const sanitizedDom = DOMPurify.sanitize(source, {
    ...config,
    RETURN_DOM: true,
  });

  const ref = useCallback(
    (element: HTMLElement) => {
      if (!element) return;

      let shadowRoot = element.shadowRoot;

      if (!shadowRoot) {
        shadowRoot = element.attachShadow({ mode: 'open' });
      }

      for (const child of shadowRoot.children) {
        shadowRoot.removeChild(child);
      }

      shadowRoot.appendChild(sanitizedDom);
      onAttached(shadowRoot);
    },
    [sanitizedDom, onAttached],
  );

  if (!host || !source) {
    return null;
  }

  return (
    <TechDocsShadowDomProvider dom={sanitizedDom}>
      {cloneElement(host, { ref })}
      {children}
    </TechDocsShadowDomProvider>
  );
};
