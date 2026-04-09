import * as url from "./url";

type Case = {
  name: string;
  url: string;
  expect: string;
};

function TestGetDomainName() {
  const cases: Case[] = [
    {
      name: "not url",
      url: "xxxxx",
      expect: "",
    },
    {
      name: "not http or https",
      url: "chrome://extensions/",
      expect: "",
    },
    {
      name: "http",
      url: "http://example.com/hoge",
      expect: "example",
    },
    {
      name: "https",
      url: "https://example.com/hoge",
      expect: "example",
    },
    {
      name: "www",
      url: "https://www.example.com/hoge",
      expect: "example",
    },
    {
      name: "sub domain",
      url: "https://test.example.com/hoge",
      expect: "test.example",
    },
    {
      name: "www with sub domain",
      url: "https://www.test.example.com/hoge",
      expect: "test.example",
    },
    {
      name: "attribute type domain",
      url: "https://example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain with www",
      url: "https://www.example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain with sub domain",
      url: "https://test.example.lg.jp/hoge",
      expect: "test.example",
    },
    {
      name: "attribute type domain with www and sub domain",
      url: "https://www.test.example.lg.jp/hoge",
      expect: "test.example",
    },
    {
      name: "second level domain",
      url: "https://example.co.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain with www",
      url: "https://www.example.co.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain with sub domain",
      url: "https://test.example.co.jp/hoge",
      expect: "test.example",
    },
    {
      name: "second level domain with www and sub domain",
      url: "https://www.test.example.co.jp/hoge",
      expect: "test.example",
    },
  ];

  cases.forEach((c) => {
    test(c.name, () => {
      const domain = url.getDomainName(c.url);
      expect(domain).toBe(c.expect);
    });
  });
}

TestGetDomainName();

function TestGetDomainNameIgnoreSubDomain() {
  const cases: Case[] = [
    {
      name: "not url",
      url: "xxxxx",
      expect: "",
    },
    {
      name: "not http or https",
      url: "chrome://extensions/",
      expect: "",
    },
    {
      name: "http",
      url: "http://example.com/hoge",
      expect: "example",
    },
    {
      name: "https",
      url: "https://example.com/hoge",
      expect: "example",
    },
    {
      name: "www",
      url: "https://www.example.com/hoge",
      expect: "example",
    },
    {
      name: "sub domain",
      url: "https://test.example.com/hoge",
      expect: "example",
    },
    {
      name: "www with sub domain",
      url: "https://www.test.example.com/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain",
      url: "https://example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain with www",
      url: "https://www.example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain with sub domain",
      url: "https://test.example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "attribute type domain with www and sub domain",
      url: "https://www.test.example.lg.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain",
      url: "https://example.co.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain with www",
      url: "https://www.example.co.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain with sub domain",
      url: "https://test.example.co.jp/hoge",
      expect: "example",
    },
    {
      name: "second level domain with www and sub domain",
      url: "https://www.test.example.co.jp/hoge",
      expect: "example",
    },
  ];

  cases.forEach((c) => {
    test(c.name, () => {
      const domain = url.getDomainNameIgnoreSubDomain(c.url);
      expect(domain).toBe(c.expect);
    });
  });
}

TestGetDomainNameIgnoreSubDomain();

function TestGetURLWithoutParameters() {
  const cases: Case[] = [
    {
      name: "URL without parameters",
      url: "https://example.com/path",
      expect: "https://example.com/path",
    },
    {
      name: "URL with query parameters",
      url: "https://example.com/path?param1=value1&param2=value2",
      expect: "https://example.com/path",
    },
    {
      name: "URL with hash fragment",
      url: "https://example.com/path#section",
      expect: "https://example.com/path",
    },
    {
      name: "URL with both query parameters and hash",
      url: "https://example.com/path?param=value#section",
      expect: "https://example.com/path",
    },
    {
      name: "URL with only query parameters",
      url: "https://example.com/?param=value",
      expect: "https://example.com/",
    },
    {
      name: "URL with port and parameters",
      url: "https://example.com:8080/path?param=value",
      expect: "https://example.com:8080/path",
    },
    {
      name: "empty URL",
      url: "",
      expect: "",
    },
  ];

  cases.forEach((c) => {
    test(c.name, () => {
      const urlWithoutParams = url.getURLWithoutParameters(c.url);
      expect(urlWithoutParams).toBe(c.expect);
    });
  });
}

TestGetURLWithoutParameters();

type GroupingKeyCase = {
  name: string;
  url: string;
  domainName: string;
  rules: { host: string; pathDepth: number }[];
  expect: string;
};

function TestGetGroupingKey() {
  const cases: GroupingKeyCase[] = [
    {
      name: "no rules, returns domain as-is",
      url: "https://docs.google.com/document/d/123",
      domainName: "docs.google",
      rules: [],
      expect: "docs.google",
    },
    {
      name: "matching rule with pathDepth 1",
      url: "https://docs.google.com/document/d/123",
      domainName: "docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "docs.google/document",
    },
    {
      name: "matching rule with pathDepth 2",
      url: "https://docs.google.com/document/d/123",
      domainName: "docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 2 }],
      expect: "docs.google/document/d",
    },
    {
      name: "matching rule, spreadsheets path",
      url: "https://docs.google.com/spreadsheets/d/456",
      domainName: "docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "docs.google/spreadsheets",
    },
    {
      name: "non-matching rule, returns domain",
      url: "https://github.com/user/repo",
      domainName: "github",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "github",
    },
    {
      name: "empty domain returns empty",
      url: "https://example.com/path",
      domainName: "",
      rules: [{ host: "example.com", pathDepth: 1 }],
      expect: "",
    },
    {
      name: "URL with no path segments",
      url: "https://docs.google.com",
      domainName: "docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "docs.google",
    },
    {
      name: "rule matches subdomain via endsWith",
      url: "https://sub.docs.google.com/document/d/123",
      domainName: "sub.docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "sub.docs.google/document",
    },
    {
      name: "URL with query params still extracts path",
      url: "https://docs.google.com/document/d/123?edit=true",
      domainName: "docs.google",
      rules: [{ host: "docs.google.com", pathDepth: 1 }],
      expect: "docs.google/document",
    },
  ];

  cases.forEach((c) => {
    test(c.name, () => {
      const key = url.getGroupingKey(c.url, c.domainName, c.rules);
      expect(key).toBe(c.expect);
    });
  });
}

TestGetGroupingKey();
