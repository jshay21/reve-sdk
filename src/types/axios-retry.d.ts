import { AxiosInstance, AxiosError } from 'axios';

declare module 'axios-retry' {
  export interface IAxiosRetryConfig {
    retries?: number;
    retryCondition?: (error: AxiosError) => boolean;
    retryDelay?: (retryCount: number, error: AxiosError) => number;
    shouldResetTimeout?: boolean;
  }
  
  export const isNetworkOrIdempotentRequestError: (error: AxiosError) => boolean;
  export const exponentialDelay: (retryCount: number) => number;
  
  function axiosRetry(
    axios: AxiosInstance,
    config?: IAxiosRetryConfig
  ): void;
  
  export default axiosRetry;
} 