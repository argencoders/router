import { TypeOf, ZodSchema } from 'zod';
import { IContainer, Instance, InstanceDefinition, LifeTime, scoped } from 'hardwired';
import ApiError from './api-error.js';

export type RouteMethod = 'get' | 'post' | 'put' | 'delete' | 'rpc';

export const PUBLIC = Symbol();

export interface ISession {
  accessToken: string;
  userId: string;
  expiresOn: Date;
}

type ExtraConfig = {
  title?: string;
  description?: string;
  section?: string;
  tags?: string[];
  deprecated?: boolean | string;
};

export type RouteConfig<
  TAuthToken,
  TParams extends Record<string, ZodSchema> | undefined,
  TQuery extends Record<string, ZodSchema> | undefined,
  TBody extends ZodSchema | undefined,
  THeaders extends Record<string, ZodSchema> | undefined,
  TResponse extends ZodSchema | undefined,
  TErrors extends Record<string, string> | undefined,
  TServices extends Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>> | undefined,
> = ExtraConfig & {
  auth?: TAuthToken;
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  headers?: THeaders;
  response?: TResponse;
  errors?: TErrors;
  services?: TServices;
  handler: (
    req: (TParams extends Record<string, ZodSchema> ? { params: { [Property in keyof TParams]: TypeOf<TParams[Property]> } } : NonNullable<unknown>) &
      (TQuery extends Record<string, ZodSchema> ? { query: { [Property in keyof TQuery]: TypeOf<TQuery[Property]> } } : NonNullable<unknown>) &
      (TBody extends ZodSchema ? { body: TypeOf<TBody> } : NonNullable<unknown>) &
      (THeaders extends Record<string, ZodSchema> ? { headers: { [Property in keyof THeaders]: TypeOf<THeaders[Property]> } } : NonNullable<unknown>) &
      (TServices extends Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>>
        ? { services: { [Property in keyof TServices]: Instance<TServices[Property]> } }
        : NonNullable<unknown>) & {
        session: TAuthToken extends typeof PUBLIC ? ISession | undefined : ISession;
        container: IContainer;
      },
  ) => Promise<(TResponse extends ZodSchema ? TypeOf<TResponse> : void) | ApiError<keyof TErrors>>;
};

export type AnyRoute = Route<
  string | typeof PUBLIC | undefined,
  Record<string, ZodSchema> | undefined,
  Record<string, ZodSchema> | undefined,
  ZodSchema | undefined,
  Record<string, ZodSchema> | undefined,
  ZodSchema,
  Record<string, string> | undefined,
  Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>> | undefined
>;

export type AnyRouteConfig = AnyRoute['config'];

type Route<
  TAuthToken,
  TParams extends Record<string, ZodSchema> | undefined,
  TQuery extends Record<string, ZodSchema> | undefined,
  TBody extends ZodSchema | undefined,
  THeaders extends Record<string, ZodSchema> | undefined,
  TResponse extends ZodSchema,
  TErrors extends Record<string, string> | undefined,
  TServices extends Record<string, InstanceDefinition<unknown, LifeTime.scoped | LifeTime.transient>> | undefined,
> = {
  key: string;
  method: RouteMethod;
  url: string;
  config: RouteConfig<TAuthToken, TParams, TQuery, TBody, THeaders, TResponse, TErrors, TServices>;
};
