import { useState, useCallback, useRef } from 'react';
import { getErrorMessage, isNetworkError } from '@/lib/validation';

interface UseSafeAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
  autoRetry?: boolean;
}

interface UseSafeAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
}

export function useSafeAsync<T = any>(options: UseSafeAsyncOptions<T> = {}) {
  const {
    onSuccess,
    onError,
    retryCount: maxRetries = 3,
    retryDelay = 1000,
    autoRetry = true,
  } = options;

  const [state, setState] = useState<UseSafeAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const execute = useCallback(
    async (asyncFn: () => Promise<T>, signal?: AbortSignal): Promise<T | null> => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Create new abort controller if not provided
      if (!signal) {
        abortControllerRef.current = new AbortController();
        signal = abortControllerRef.current.signal;
      }

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const data = await asyncFn();
        
        setState(prev => ({
          ...prev,
          data,
          loading: false,
          retryCount: 0,
        }));

        onSuccess?.(data);
        return data;
      } catch (error) {
        // Check if the operation was aborted
        if (signal?.aborted) {
          setState(prev => ({
            ...prev,
            loading: false,
          }));
          return null;
        }

        const errorObj = error instanceof Error ? error : new Error(getErrorMessage(error));
        
        setState(prev => ({
          ...prev,
          error: errorObj,
          retryCount: prev.retryCount + 1,
        }));

        onError?.(errorObj);

        // Auto-retry for network errors
        if (
          autoRetry &&
          isNetworkError(errorObj) &&
          state.retryCount < maxRetries
        ) {
          timeoutRef.current = setTimeout(() => {
            execute(asyncFn, signal);
          }, retryDelay * (state.retryCount + 1)); // Exponential backoff
        }

        return null;
      }
    },
    [onSuccess, onError, maxRetries, retryDelay, autoRetry, state.retryCount]
  );

  const retry = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      retryCount: 0,
    }));
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0,
    });
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      loading: false,
    }));
  }, []);

  return {
    ...state,
    execute,
    retry,
    reset,
    cancel,
  };
}

// Specialized hook for data fetching with caching
export function useSafeFetch<T = any>(options: UseSafeAsyncOptions<T> & { cacheTime?: number } = {}) {
  const { cacheTime = 5 * 60 * 1000, ...asyncOptions } = options; // 5 minutes default
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchWithCache = useCallback(
    async (url: string, fetchOptions?: RequestInit): Promise<T> => {
      const cacheKey = `${url}-${JSON.stringify(fetchOptions)}`;
      const cached = cacheRef.current.get(cacheKey);

      // Return cached data if still valid
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        signal: fetchOptions?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      cacheRef.current.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    },
    [cacheTime]
  );

  const safeFetch = useSafeAsync<T>(asyncOptions);

  return {
    ...safeFetch,
    fetch: (url: string, options?: RequestInit) => safeFetch.execute(() => fetchWithCache(url, options)),
    clearCache: () => cacheRef.current.clear(),
  };
} 