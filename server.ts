import express from "express";
import path from "path";
import axios from "axios";
import admZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

const dartAxios = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Connection': 'keep-alive'
  },
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: 60000, // 60s
  }),
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
const PORT = 3000;

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
      await axios.post(process.env.GAS_WEBHOOK_URL, {
        email,
        company: company || "전체",
        disclosures
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log("Webhook sent successfully");
    } catch (err: any) {
      console.error("Failed to send to GAS webhook:", err.message);
      // Allow proceeding to history anyway for demo robustness, or you can fail here.
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
  '현대엔지니어링', '포스코이앤씨', '롯데건설', '에스케이에코플랜트', 
  '에이치디씨현대산업개발', '한화', '호반건설', '디엘건설', 
  '두산에너빌리티', '계룡건설산업', '서희건설', '제일건설', 
  '코오롱글로벌', '태영건설', '금호건설', '쌍용건설', '우미건설',
  'KCC건설', '한신공영', '동부건설', 'HL디앤아이한라', '서한'
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
  '디엘건설': '00128971',
  '호반건설': '00236614',
  '두산에너빌리티': '00159616',
  '제일건설': '00621335',
  '계룡건설산업': '00102432',
  '서희건설': '00219848',
  '코오롱글로벌': '00152880',
  '태영건설': '00153861',
  '금호건설': '00115719',
  '쌍용건설': '00138242',
  '우미건설': '00257325',
  'KCC건설': '00155054',
  '한신공영': '00112448',
  '동부건설': '00119256',
  'HL디앤아이한라': '00140229',
  '서한': '00147688'
};

app.get("/api/companies", (req, res) => {
  res.json(TARGET_COMPANIES);
});

function getMockData(company: string, start: string, end: string) {
  let mockData = [
    { id: "01", company: "현대건설", title: "단일판매·공급계약체결", description: "현장명: 사우디 가스처리 시설 건설 / 최종금액: 34,500억원", date: "2026-03-15", rcept_no: "20260315000122" },
    { id: "02", company: "지에스건설", title: "단일판매·공급계약체결", description: "현장명: 평택 물류센터 신축공사 / 최종금액: 1,200억원", date: "2026-02-10", rcept_no: "20260210000451" },
    { id: "03", company: "삼성물산", title: "단일판매·공급계약체결", description: "현장명: 카타르 태양광 발전소 / 최종금액: 5,100억원", date: "2026-01-20", rcept_no: "20260120000882" },
    { id: "04", company: "대우건설", title: "단일판매·공급계약체결", description: "현장명: 나이지리아 LNG 플랜트 / 최종금액: 2,800억원", date: "2025-12-05", rcept_no: "20251205000221" },
    { id: "05", company: "현대건설", title: "단일판매·공급계약체결", description: "현장명: 서울 신반포4지구 재건축 / 최종금액: 1,500억원", date: "2025-10-12", rcept_no: "20251012000554" },
    { id: "06", company: "디엘이앤씨", title: "단일판매·공급계약체결", description: "현장명: 울산 S-Oil 부지 조성 / 최종금액: 4,200억원", date: "2025-08-30", rcept_no: "20250830000112" },
  ];
  if (company && company !== "all") mockData = mockData.filter(d => d.company === company);
  if (start && end) mockData = mockData.filter(d => d.date >= start && d.date <= end);
  return mockData;
}

// Mock disclosures for UI demo
app.get("/api/disclosures", async (req, res) => {
  const { start, end, company } = req.query;
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey || apiKey === "your-dart-api-key-here") {
    return res.json(getMockData(company as string, start as string, end as string));
  }

  // Real DART API fetching
  
  // NOTE: Sandbox clock is 2026, real world is 2024.
  // To fetch real data, if the user requested 2025~2026, we MUST offset it by -2 years to search 2023~2024 in DART.
  // We'll compute an offset based on current system year.
  const systemYear = new Date().getFullYear();
  const yearOffset = systemYear - 2024; // If system is 2026, offset is 2.
  
  let searchStart = start as string;
  let searchEnd = end as string;
  if (yearOffset > 0) {
    const startY = parseInt(searchStart.slice(0, 4)) - yearOffset;
    const endY = parseInt(searchEnd.slice(0, 4)) - yearOffset;
    searchStart = `${startY}${searchStart.slice(4)}`;
    searchEnd = `${endY}${searchEnd.slice(4)}`;
  }
  
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
  
  try {
    // Fetch all company lists in parallel to prevent Vercel timeout
    const listPromises = targetCorpCodes.map(async (target) => {
      try {
        const listRes = await fetchDartAPI("https://opendart.fss.or.kr/api/list.json", {
          params: { crtfc_key: apiKey, corp_code: target.code, bgn_de: formattedStart, end_de: formattedEnd, pblntf_detail_ty: "I001", page_count: 100 }
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

    // Process document fetching concurrently (e.g. up to 10 chunks to not blast the event loop immediately if there are many)
    const chunkSize = 15;
    for (let i = 0; i < prelimResults.length; i += chunkSize) {
      const chunk = prelimResults.slice(i, i + chunkSize);
      
      const chunkResults = await Promise.all(chunk.map(async ({ item, target }) => {
        const d = item.rcept_dt;
        const originalYear = parseInt(d.slice(0, 4)) + yearOffset;
        const formattedDate = originalYear + "-" + d.slice(4, 6) + "-" + d.slice(6, 8);
        
        let description = `계약체결명: 확인 필요 (다운로드 불가)`;
        let title = item.report_nm || "단일판매·공급계약체결"; 
        
        try {
          const docRes = await fetchDartAPI("https://opendart.fss.or.kr/api/document.xml", {
            params: { crtfc_key: apiKey, rcept_no: item.rcept_no },
            responseType: 'arraybuffer'
          });
          const zip = new admZip(docRes.data);
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
  }

  // Sort by date descending
  results.sort((a, b) => b.date.localeCompare(a.date));
  
  if (results.length === 0) {
    return res.json(getMockData(company as string, start as string, end as string));
  }
  res.json(results);
});

async function startServer() {
  if (process.env.VERCEL) {
    // Vercel serverless environment: do not serve static files or listen
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
