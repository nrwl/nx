import { BlockList } from 'net';
import { networkInterfaces } from 'os';

// webpack-dev-server and the Rspack dev server resolve these hosts when they
// start (`Server.getHostname`). A wildcard fallback means loopback to the probe.
export function resolveStartupHost(
  host: string | undefined
): string | undefined {
  switch (host) {
    case 'local-ip':
      return findIp('IPv4') ?? findIp('IPv6') ?? '0.0.0.0';
    case 'local-ipv4':
      return findIp('IPv4') ?? '0.0.0.0';
    case 'local-ipv6':
      return findIp('IPv6') ?? '::';
    default:
      return host;
  }
}

// The IPv6 ranges `Server.findIp` accepts: unique local, IPv4-mapped, loopback
const FIND_IP_V6_RANGES = new BlockList();
FIND_IP_V6_RANGES.addSubnet('fc00::', 7, 'ipv6');
FIND_IP_V6_RANGES.addSubnet('::ffff:0:0', 96, 'ipv6');
FIND_IP_V6_RANGES.addAddress('::1', 'ipv6');

function findIp(family: 'IPv4' | 'IPv6'): string | undefined {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find(
      ({ address, family: addressFamily, internal }) =>
        address &&
        addressFamily === family &&
        !internal &&
        (family === 'IPv4' || FIND_IP_V6_RANGES.check(address, 'ipv6'))
    )?.address;
}
