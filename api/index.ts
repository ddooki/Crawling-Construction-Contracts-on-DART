import express from "express";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import https from "https";
import AdmZip from "adm-zip";
import xml2js from "xml2js";

const { parseStringPromise } = xml2js;

dotenv.config();

const dartAxios = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Connection': 'keep-alive'
  }
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchDartAPI(url: string, config: any, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) await delay(1000 * i);
      else await delay(100);
      return await dartAxios.get(url, config);
    } catch (err: any) {
      if (err?.code === 'ECONNRESET') {
         console.warn(`ECONNRESET on ${url}, retrying...`);
      }
      if (i === retries) throw err;
      console.warn(`Retry ${i + 1} for ${url} due to ${err.message}`);
      await delay(1000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

const app = express();

// API Routes
app.get("/api/status", (req, res) => {
  res.json({ status: "connected", version: "Ver. 1.0.0" });
});

// Store sent history in memory
let sentHistory: any[] = [];

function formatKoreanCurrency(amountStr: string) {
  const numStr = amountStr.replace(/[^\d]/g, '');
  if (!numStr) return '';
  const amt = parseInt(numStr, 10);
  if (isNaN(amt)) return '';

  const jeon = Math.floor(amt / 1000000000000);
  const uk = Math.floor((amt % 1000000000000) / 100000000);

  let res = [];
  if (jeon > 0) res.push(`${jeon}조`);
  if (uk > 0) res.push(`${uk}억`);
  
  if (res.length === 0) return '1억원 미만';
  return res.join(' ') + '원';
}

app.post("/api/send-report", express.json(), async (req, res) => {
  const { email, company, disclosures } = req.body;
  
  // Forward to GAS Webhook if configured
  if (process.env.GAS_WEBHOOK_URL) {
    try {
      const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      const userAgent = req.headers["user-agent"] || "";
      await axios.post(process.env.GAS_WEBHOOK_URL, {
        action: "send-report",
        email,
        company: company || "전체",
        disclosures,
        ip: clientIp,
        userAgent: userAgent
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("Webhook sent successfully");
    } catch (err: any) {
      console.error("Failed to send to GAS webhook:", err.message);
    }
  } else {
    console.log("GAS_WEBHOOK_URL is not provided in .env, skipping real email send.");
  }

  const newEntry = {
    id: sentHistory.length + 1,
    email,
    company: company || "전체",
    date: new Date().toLocaleString(),
    status: "Success"
  };
  sentHistory.unshift(newEntry);
  res.json({ success: true, entry: newEntry });
});

app.get("/api/history", (req, res) => {
  res.json(sentHistory);
});

// Target companies list
const TARGET_COMPANIES = [
  '삼성물산', '현대건설', '대우건설', '디엘이앤씨', '지에스건설', 
  '현대엔지니어링', '포스코이앤씨', '롯데건설', '에스케이에코플랜트', '에이치디씨현대산업개발', 
  '한화', '호반건설', '디엘건설', '두산에너빌리티', '계룡건설산업', 
  '서희건설', '제일건설', '코오롱글로벌', '태영건설', '케이씨씨건설'
];

// Pre-mapped DART corp codes for target companies to avoid downloading large XML and ECONNRESET issues
const corpCodeMap: Record<string, string> = {
  '삼성물산': '00149655',
  '현대건설': '00164478',
  '대우건설': '00124540',
  '디엘이앤씨': '01524093',
  '지에스건설': '00532819',
  '현대엔지니어링': '01465666',
  '포스코이앤씨': '00100814',
  '롯데건설': '00120438',
  '에스케이에코플랜트': '00131799',
  '에이치디씨현대산업개발': '01310269',
  '한화': '00160588',
  '호반건설': '00236614',
  '디엘건설': '00128971',
  '두산에너빌리티': '00159616',
  '계룡건설산업': '00102432',
  '서희건설': '00219848',
  '제일건설': '00621335',
  '코오롱글로벌': '00152880',
  '태영건설': '00153861',
  '케이씨씨건설': '00155054'
};

app.get("/api/companies", (req, res) => {
  res.json(TARGET_COMPANIES);
});

app.get("/api/api-count", async (req, res) => {
  let globalCount = 0;
  if (process.env.GAS_WEBHOOK_URL) {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || "";
    try {
      const gasRes = await axios.post(process.env.GAS_WEBHOOK_URL, {
        action: "get-api-count",
        ip: clientIp,
        userAgent: userAgent
      });
      if (gasRes.data && gasRes.data.success) {
        globalCount = gasRes.data.count;
      }
    } catch (e: any) {
      console.error("Failed to fetch call count from GAS:", e.message);
    }
  }
  res.json({ count: globalCount });
});

app.get("/api/check-key", (req, res) => {
  const apiKey = process.env.DART_API_KEY;
  res.json({
    keyExists: !!apiKey,
    keyLength: apiKey ? apiKey.length : 0,
    preview: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "none",
    nodeEnv: process.env.NODE_ENV || "unknown"
  });
});

// Disclosures endpoint
app.get("/api/disclosures", async (req, res) => {
  const { start, end, company } = req.query;
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey || apiKey === "your-dart-api-key-here") {
    return res.status(401).json({ error: "DART API Key가 설정되지 않았습니다. Vercel 환경 변수에 DART_API_KEY를 등록해 주세요." });
  }

  let searchStart = start as string;
  let searchEnd = end as string;
  
  const formattedStart = searchStart.replace(/-/g, "");
  const formattedEnd = searchEnd.replace(/-/g, "");

  let extendedCorpMap = { ...corpCodeMap };
  if (req.query.custom_companies) {
    try {
      const parsed = JSON.parse(req.query.custom_companies as string);
      extendedCorpMap = { ...extendedCorpMap, ...parsed };
    } catch (e) {
      console.error("Failed to parse custom_companies", e);
    }
  }

  let targetCorpCodes: Array<{name: string, code: string}> = [];
  
  if (company && company !== "all") {
    const code = extendedCorpMap[company as string];
    if (code) targetCorpCodes.push({ name: company as string, code });
  } else {
    targetCorpCodes = Object.keys(extendedCorpMap).map(k => ({ name: k, code: extendedCorpMap[k] }));
  }

  let results: any[] = [];
  let apiCallCount = 0;
  
  try {
    const listPromises = targetCorpCodes.map(async (target) => {
      try {
        apiCallCount++;
        const listRes = await fetchDartAPI("https://opendart.fss.or.kr/api/list.json", {
          params: { crtfc_key: apiKey, corp_code: target.code, bgn_de: formattedStart, end_de: formattedEnd, page_count: 100 }
        });
        if (listRes && listRes.data && listRes.data.status === "000" && listRes.data.list) {
          return listRes.data.list
            .filter((item: any) => item.report_nm.includes("단일판매") || item.report_nm.includes("수주") || item.report_nm.includes("공급계약"))
            .map((item: any) => ({ item, target }));
        }
      } catch (err: any) {
        console.error(`Failed for ${target.name}:`, err.message);
      }
      return [];
    });

    const listResults = await Promise.all(listPromises);
    const prelimResults = listResults.flat();

    const chunkSize = 15;
    for (let i = 0; i < prelimResults.length; i += chunkSize) {
      const chunk = prelimResults.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.all(chunk.map(async ({ item, target }) => {
        const d = item.rcept_dt;
        const formattedDate = d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
        
        let description = `계약체결명: 확인 필요 (다운로드 불가)`;
        let title = item.report_nm || "단일판매·공급계약체결"; 
        
        try {
          apiCallCount++;
          const docRes = await fetchDartAPI("https://opendart.fss.or.kr/api/document.xml", {
            params: { crtfc_key: apiKey, rcept_no: item.rcept_no },
            responseType: 'arraybuffer'
          });
          const zip = new AdmZip(docRes.data);
          const xmlEntry = zip.getEntries()[0];
          if (xmlEntry) {
            const xmlText = xmlEntry.getData().toString("utf8");
            const stripHtml = (str: string) => str.replace(/<[^>]*>?/g, '').trim();
            
            const matchLastContent = (str: string, regex: RegExp) => {
                const matches = Array.from(str.matchAll(regex));
                if (matches.length > 0) {
                    const lastMatch = matches[matches.length - 1][1];
                    return stripHtml(lastMatch);
                }
                return "";
            };
            
            let projName = matchLastContent(xmlText, /체결계약명.*?<td.*?>\s*(.*?)\s*<\/td>/gis);
            if (!projName) projName = matchLastContent(xmlText, /판매.공급계약\s*내용.*?<td.*?>\s*(.*?)\s*<\/td>/gis);
            
            let amtName = matchLastContent(xmlText, /계약금액\(원\).*?<td.*?>\s*(.*?)\s*<\/td>/gis);
            if (!amtName) amtName = matchLastContent(xmlText, /계약금액\s*총액\(원\).*?<td.*?>\s*(.*?)\s*<\/td>/gis);
            if (!amtName) amtName = matchLastContent(xmlText, /확정\s*계약금액.*?<td.*?>\s*(.*?)\s*<\/td>/gis);
            if (!amtName) amtName = matchLastContent(xmlText, /계약금액.*?<td.*?>\s*(.*?)\s*<\/td>/gis);

            let formattedAmt = amtName ? formatKoreanCurrency(amtName) : "";

            if (projName || formattedAmt) {
                description = `계약체결명: ${projName || "-"} / 계약금액: ${formattedAmt || "-"}`;
            }
          }
        } catch (err: any) {
          console.warn(`Failed to fetch doc info for ${item.rcept_no}`, err.message);
        }
        return {
          id: item.rcept_no,
          company: target.name,
          title: title, 
          description: description,
          date: formattedDate,
          rcept_no: item.rcept_no
        };
      }));
      results.push(...chunkResults);
    }
  } catch (err: any) {
    console.error("Error fetching disclosures from DART:", err.message);
    return res.status(500).json({ error: "DART API 조회 중 오류가 발생했습니다: " + err.message });
  }

  results.sort((a, b) => b.date.localeCompare(a.date));

  // Sync with GAS Webhook for global daily count tracking
  let finalGlobalCount = apiCallCount;
  if (process.env.GAS_WEBHOOK_URL && apiCallCount > 0) {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || "";
    try {
      const gasRes = await axios.post(process.env.GAS_WEBHOOK_URL, {
        action: "increment-api-count",
        addedCalls: apiCallCount,
        ip: clientIp,
        userAgent: userAgent,
        company: company || "전체"
      });
      if (gasRes.data && gasRes.data.success) {
        finalGlobalCount = gasRes.data.count;
      }
    } catch (e: any) {
      console.error("Failed to sync call count with GAS:", e.message);
    }
  }

  res.json({
    results,
    apiCallCount: finalGlobalCount
  });
});

export default app;
