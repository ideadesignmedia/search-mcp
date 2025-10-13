declare module "@ideadesignmedia/request" {
  interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
  }

  export function request(
    url?: string,
    options?: RequestOptions,
    data?: unknown,
  ): Promise<unknown>;
}