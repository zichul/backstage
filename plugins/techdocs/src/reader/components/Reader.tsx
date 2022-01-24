/*
 * Copyright 2020 The Backstage Authors
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
  PropsWithChildren,
  ComponentType,
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';

import { useParams } from 'react-router-dom';

import { makeStyles, Grid } from '@material-ui/core';

import { BackstageTheme } from '@backstage/theme';
import { EntityName } from '@backstage/catalog-model';

import { TechDocsSearch } from './TechDocsSearch';
import { TechDocsStatus } from './TechDocsStateIndicator';
import { TechDocsContent } from './TechDocsContent';
import { useReaderState } from './useReaderState';

type Props = {
  entityRef: EntityName;
  withSearch?: boolean;
  onReady?: () => void;
};

const useStyles = makeStyles<BackstageTheme>(theme => ({
  searchBar: {
    marginLeft: '20rem',
    maxWidth: 'calc(100% - 20rem * 2 - 3rem)',
    marginTop: theme.spacing(1),
    '@media screen and (max-width: 76.1875em)': {
      marginLeft: '10rem',
      maxWidth: 'calc(100% - 10rem)',
    },
  },
}));

type TechDocsReaderValue = ReturnType<typeof useReaderState> & {
  entityName: EntityName;
};

const TechDocsReaderContext = createContext<TechDocsReaderValue>(
  {} as TechDocsReaderValue,
);

export const TechDocsReaderProvider = ({
  children,
  entityName,
}: PropsWithChildren<{ entityName: EntityName }>) => {
  const { '*': path } = useParams();
  const { kind, namespace, name } = entityName;
  const state = useReaderState(kind, namespace, name, path);
  return (
    <TechDocsReaderContext.Provider value={{ ...state, entityName }}>
      {children}
    </TechDocsReaderContext.Provider>
  );
};

/**
 * Note: this HOC is currently being exported so that we can rapidly
 * iterate on alternative <Reader /> implementations that extend core
 * functionality. There is no guarantee that this HOC will continue to be
 * exported by the package in the future!
 *
 * todo: Make public or stop exporting (ctrl+f "altReaderExperiments")
 * @internal
 */
export const withTechDocsReaderProvider =
  <T extends {}>(Component: ComponentType<T>, entityName: EntityName) =>
  (props: T) =>
    (
      <TechDocsReaderProvider entityName={entityName}>
        <Component {...props} />
      </TechDocsReaderProvider>
    );

/**
 * Note: this hook is currently being exported so that we can rapidly
 * iterate on alternative <Reader /> implementations that extend core
 * functionality. There is no guarantee that this hook will continue to be
 * exported by the package in the future!
 *
 * todo: Make public or stop exporting (ctrl+f "altReaderExperiments")
 * @internal
 */
export const useTechDocsReader = () => useContext(TechDocsReaderContext);

const TechDocsReaderPage = ({
  onReady = () => {},
  withSearch = true,
}: Omit<Props, 'entityRef'>) => {
  const classes = useStyles();
  const { content, entityName } = useTechDocsReader();
  const [loading, setLoading] = useState(true);

  const handleOnLoad = useCallback(() => {
    setLoading(false);
    onReady();
  }, [setLoading, onReady]);

  return (
    <Grid container>
      <Grid item xs={12}>
        <TechDocsStatus />
      </Grid>
      {!loading && withSearch && (
        <Grid className={classes.searchBar} item xs={12}>
          <TechDocsSearch entityId={entityName} />
        </Grid>
      )}
      {content && (
        <Grid item xs={12}>
          <TechDocsContent onLoad={handleOnLoad} />
        </Grid>
      )}
    </Grid>
  );
};

export const Reader = ({ entityRef, ...rest }: Props) => (
  <TechDocsReaderProvider entityName={entityRef}>
    <TechDocsReaderPage {...rest} />
  </TechDocsReaderProvider>
);
