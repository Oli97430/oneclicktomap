import type { OneClickToMapApi } from '../../shared/contract';

declare global {
  interface Window {
    oneClickToMap: OneClickToMapApi;
  }
}

export {};
