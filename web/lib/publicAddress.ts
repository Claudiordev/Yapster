import net from "node:net";

/**
 * Whether an IP address is a normal public internet address. Link previews make our
 * server fetch URLs people paste into chat, so anything pointing inside (loopback,
 * LAN, cloud metadata, link-local, ...) must be refused.
 */
const blocked = new net.BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. the 169.254.169.254 metadata endpoint
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64: can embed any IPv4 address
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(address, prefix, "ipv6");
}

/** `::ffff:a.b.c.d` / `::ffff:aabb:ccdd` carry an IPv4 address; judge that instead. */
function unwrapMappedIpv4(ip: string): string {
  const lower = ip.toLowerCase();
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);

  if (dotted) return dotted[1];

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);

  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);

    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }

  return ip;
}

export function isPublicAddress(ip: string): boolean {
  const address = unwrapMappedIpv4(ip);

  if (net.isIPv4(address)) return !blocked.check(address, "ipv4");
  if (net.isIPv6(address)) return !blocked.check(address, "ipv6");

  return false;
}
