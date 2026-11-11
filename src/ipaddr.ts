// ipaddr.ts — minimal ipaddress port for nltk.pathsec SSRF checks.
// Original: CPython ipaddress.py address classification used by nltk/pathsec.py
// (is_private/is_global/is_multicast, ipv4_mapped, sixtofour, teredo, NAT64/compat embeds).
// Scope: address parsing + the IANA special-registry tables pathsec consults.

export class IpAddress {
  constructor(readonly version: 4 | 6, readonly ip: bigint) {}

  static parse(text: string): IpAddress {
    const s = text.trim();
    const v4 = parseV4(s);
    if (v4 !== null) return new IpAddress(4, v4);
    const v6 = parseV6(s);
    if (v6 !== null) return new IpAddress(6, v6);
    throw new SyntaxError(`${text} does not appear to be an IPv4 or IPv6 address`);
  }

  /** Integer form masked into `bits` of the address family. */
  get packed(): bigint {
    return this.ip & ((1n << BigInt(this.version === 4 ? 32 : 128)) - 1n);
  }

  get isPrivate(): boolean {
    const mapped = this.ipv4Mapped;
    if (mapped) return mapped.isPrivate;
    const { priv, exc } = this.version === 4 ? V4_TABLES : V6_TABLES;
    return priv.some(([b, p]) => inNet(this.ip, b, p, this.bits)) &&
      !exc.some(([b, p]) => inNet(this.ip, b, p, this.bits));
  }

  get isGlobal(): boolean {
    const mapped = this.ipv4Mapped;
    if (mapped) return mapped.isGlobal;
    if (this.version === 4 && inNet(this.ip, SHARED_V4[0], SHARED_V4[1], 32)) return false;
    return !this.isPrivate;
  }

  get isMulticast(): boolean {
    const [base, plen] = this.version === 4 ? MCAST_V4 : MCAST_V6;
    return inNet(this.ip, base, plen, this.bits);
  }

  get isUnspecified(): boolean {
    const mapped = this.ipv4Mapped;
    return mapped ? mapped.ip === 0n : this.ip === 0n;
  }

  get ipv4Mapped(): IpAddress | null {
    if (this.version !== 6 || (this.ip >> 32n) !== 0xffffn) return null;
    return new IpAddress(4, this.ip & 0xffffffffn);
  }

  /** (server, client) Teredo pair for 2001::/32, else null. */
  get teredo(): [IpAddress, IpAddress] | null {
    if (this.version !== 6 || (this.ip >> 96n) !== 0x20010000n) return null;
    return [
      new IpAddress(4, (this.ip >> 64n) & 0xffffffffn),
      new IpAddress(4, ~this.ip & 0xffffffffn),
    ];
  }

  /** Embedded IPv4 for 2002::/16 (6to4), else null. */
  get sixtofour(): IpAddress | null {
    if (this.version !== 6 || (this.ip >> 112n) !== 0x2002n) return null;
    return new IpAddress(4, (this.ip >> 80n) & 0xffffffffn);
  }

  private get bits(): number { return this.version === 4 ? 32 : 128; }

  toString(): string {
    if (this.version === 4) {
      return [24, 16, 8, 0].map(s => Number((this.ip >> BigInt(s)) & 0xffn)).join(".");
    }
    const v4m = this.ipv4Mapped;
    if (v4m) return `::ffff:${v4m}`;
    const groups: string[] = [];
    for (let i = 7; i >= 0; i--) groups.push(((this.ip >> BigInt(i * 16)) & 0xffffn).toString(16));
    // RFC 5952 longest zero run (length > 1)
    let best = -1, bestLen = 0, cur = -1, curLen = 0;
    for (let i = 0; i < 8; i++) {
      if (groups[i] === "0") { if (cur < 0) { cur = i; curLen = 1; } else curLen++; }
      else { if (curLen > bestLen) { best = cur; bestLen = curLen; } cur = -1; curLen = 0; }
    }
    if (curLen > bestLen) { best = cur; bestLen = curLen; }
    if (bestLen <= 1) best = -1;
    const left = groups.slice(0, best).join(":");
    const right = groups.slice(best + bestLen).join(":");
    return best < 0 ? groups.join(":") : `${left}::${right}`;
  }
}

export function ipAddress(text: string): IpAddress {
  return IpAddress.parse(text);
}

function inNet(ip: bigint, base: bigint, plen: number, bits: number): boolean {
  const shift = BigInt(bits - plen);
  return (ip >> shift) === (base >> shift);
}

function net(base: string, plen: number): [bigint, number] {
  return [IpAddress.parse(base).ip, plen];
}

function parseV4(s: string): bigint | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  let ip = 0n;
  for (let i = 1; i <= 4; i++) {
    const oct = Number(m[i]);
    if (oct > 255 || (m[i]!.length > 1 && m[i]!.startsWith("0"))) return null;
    ip = (ip << 8n) | BigInt(oct);
  }
  return ip;
}

function parseV6(s: string): bigint | null {
  // Optional %zone (Python 3.13+ scoped addresses) — scope ignored for classification.
  const scoped = s.split("%");
  if (scoped.length > 2) return null;
  const body = scoped[0]!;
  const parts = body.split("::");
  if (parts.length > 2) return null;
  const hextets: number[] = [];
  const readSide = (side: string): number[] | null => {
    if (side === "") return [];
    const out: number[] = [];
    const groups = side.split(":");
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      if (g === "") return null;
      if (g.includes(".")) {
        if (i !== groups.length - 1) return null;
        const v4 = parseV4(g);
        if (v4 === null) return null;
        out.push(Number((v4 >> 16n) & 0xffffn), Number(v4 & 0xffffn));
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
        out.push(parseInt(g, 16));
      }
    }
    return out;
  };
  const head = readSide(parts[0]!);
  if (head === null) return null;
  hextets.push(...head);
  if (parts.length === 2) {
    const tail = readSide(parts[1]!);
    if (tail === null) return null;
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    for (let i = 0; i < fill; i++) hextets.push(0);
    hextets.push(...tail);
  }
  if (hextets.length !== 8) return null;
  let ip = 0n;
  for (const h of hextets) ip = (ip << 16n) | BigInt(h);
  return ip;
}

// IANA special registries mirrored from CPython 3.14 ipaddress._IPv4Constants /
// _IPv6Constants — the tables nltk.pathsec._ip_is_forbidden relies on.
const V4_TABLES = {
  priv: [
    net("0.0.0.0", 8), net("10.0.0.0", 8), net("127.0.0.0", 8),
    net("169.254.0.0", 16), net("172.16.0.0", 12), net("192.0.0.0", 24),
    net("192.0.0.170", 31), net("192.0.2.0", 24), net("192.168.0.0", 16),
    net("198.18.0.0", 15), net("198.51.100.0", 24), net("203.0.113.0", 24),
    net("240.0.0.0", 4), net("255.255.255.255", 32),
  ],
  exc: [net("192.0.0.9", 32), net("192.0.0.10", 32)],
};

const V6_TABLES = {
  priv: [
    net("::1", 128), net("::", 128), net("::ffff:0.0.0.0", 96),
    net("64:ff9b:1::", 48), net("100::", 64), net("2001::", 23),
    net("2001:db8::", 32), net("2002::", 16), net("3fff::", 20),
    net("fc00::", 7), net("fe80::", 10),
  ],
  exc: [
    net("2001:1::1", 128), net("2001:1::2", 128), net("2001:3::", 32),
    net("2001:4:112::", 48), net("2001:20::", 28), net("2001:30::", 28),
  ],
};

const SHARED_V4 = net("100.64.0.0", 10);
const MCAST_V4 = net("224.0.0.0", 4);
const MCAST_V6 = net("ff00::", 8);
