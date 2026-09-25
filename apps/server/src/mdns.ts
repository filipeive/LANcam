/**
 * LANCam Server — mDNS / ZeroConf Local Network Discovery
 *
 * Advertises the LANCam HTTP/HTTPS service on the local network
 * as `lancam.local` so local devices and OBS can discover the server.
 */

import { Bonjour } from 'bonjour-service';
import { createLogger } from './logger.js';

const log = createLogger('mdns');

export interface MDNSServiceController {
  stop: () => void;
}

export function startMDNSDiscovery(port: number, name: string = 'lancam'): MDNSServiceController | null {
  try {
    const instance = new Bonjour();

    const service = instance.publish({
      name: name,
      type: 'http',
      port: port,
      txt: {
        app: 'LANCam',
        version: '0.1.0',
        url: `http://${name}.local:${port}/`,
      },
    });

    log.info(`mDNS ZeroConf service published on local network (http://${name}.local:${port})`, {
      name,
      type: 'http',
      port,
    });

    return {
      stop: () => {
        try {
          service.stop();
          instance.destroy();
          log.info('mDNS service stopped');
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.warn('Could not publish mDNS service (lancam.local):', { error: message });
    return null;
  }
}
