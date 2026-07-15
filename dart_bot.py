import os
import requests
import zipfile
import io
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv

# .env 파일에서 환경변수 로드
load_dotenv()

# ==========================================
# [설정 정보] - .env 파일에 입력하세요
# ==========================================
DART_API_KEY = os.getenv("DART_API_KEY")
GAS_WEBHOOK_URL = os.getenv("GAS_WEBHOOK_URL") # GAS 배포 후 얻은 URL
SENT_DB_FILE = "sent_reports.txt"

# 감시 대상 건설사 리스트 (19개)
TARGET_COMPANIES = [
    '삼성물산', '현대건설', '대우건설', '디엘이앤씨', '지에스건설', 
    '현대엔지니어링', '포스코이앤씨', '롯데건설', '에스케이에코플랜트', 
    '에이치디씨현대산업개발', '한화', '호반건설', '디엘건설', 
    '두산에너빌리티', '계룡건설산업', '서희건설', '제일건설', 
    '코오롱글로벌', '태영건설'
]

def check_disclosures():
    """ 오늘자 공시 확인 및 수주 계약 필터링 """
    print("[1/3] DART 신규 공시 검색 시작...")
    today = datetime.now().strftime('%Y%m%d')
    url = "https://opendart.fss.or.kr/api/list.json"
    
    params = {
        'crtfc_key': DART_API_KEY,
        'bgn_de': today,
        'pblntf_ty': 'I', # 주요사항보고서
        'page_count': '100'
    }
    
    try:
        response = requests.get(url, params=params).json()
        if response.get('status') != '000':
            print(f" - API 오류: {response.get('message')}")
            return []

        # 기존 발송 리스트 확인
        sent_list = []
        if os.path.exists(SENT_DB_FILE):
            with open(SENT_DB_FILE, 'r') as f:
                sent_list = f.read().splitlines()

        new_items = []
        for item in response.get('list', []):
            corp_name = item['corp_name']
            report_nm = item['report_nm']
            rcept_no = item['rcept_no']

            # 건설사 매칭 & 키워드 확인 & 중복 제외
            is_target = any(target in corp_name for target in TARGET_COMPANIES)
            is_contract = any(kw in report_nm for kw in ["단일판매", "공급계약"])
            
            if is_target and is_contract and rcept_no not in sent_list:
                new_items.append({
                    'company': corp_name,
                    'title': report_nm,
                    'link': f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}",
                    'id': rcept_no
                })
        
        return new_items
    except Exception as e:
        print(f" - 공시 확인 중 에러: {e}")
        return []

def notify_via_gas(item):
    """ GAS 웹훅을 호출하여 이메일 발송 요청 """
    print(f" - [{item['company']}] GAS 웹훅 호출 중...")
    try:
        payload = {
            "company": item['company'],
            "title": item['title'],
            "link": item['link']
        }
        res = requests.post(GAS_WEBHOOK_URL, json=payload)
        
        if res.status_code == 200:
            print("   => 알림 요청 성공")
            # 발송 기록 저장
            with open(SENT_DB_FILE, 'a') as f:
                f.write(f"{item['id']}\n")
        else:
            print(f"   => 알림 요청 실패 (HTTP {res.status_code})")
    except Exception as e:
        print(f"   => 웹훅 에러: {e}")

def main():
    if not DART_API_KEY or not GAS_WEBHOOK_URL:
        print("!!! ERROR: .env 파일에 DART_API_KEY와 GAS_WEBHOOK_URL을 설정해주세요.")
        return

    contracts = check_disclosures()
    
    if not contracts:
        print("[결과] 신규 수주 공시가 없습니다.")
        return

    print(f"[2/3] 총 {len(contracts)}건의 신규 공시 발견!")
    print("[3/3] GAS 알림 프로세스 가동...")
    
    for item in contracts:
        notify_via_gas(item)

if __name__ == "__main__":
    main()

# ---------------------------------------------------------
# [Google Apps Script 코드 (GAS)]
# ---------------------------------------------------------
"""
// 구글 앱 스크립트 에디터에 아래 코드를 복사해 넣으세요.

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var company = data.company;
    var title = data.title;
    var link = data.link;
    
    // 알림을 받을 이메일 주소 (본인 이메일)
    var myEmail = "사용자_이메일@gmail.com"; 
    
    var subject = "[수주 알림] " + company + " 신규 공시 발생!";
    var body = "건설사: " + company + "\n" +
               "보고서명: " + title + "\n" +
               "원문 링크: " + link + "\n\n" +
               "본 메일은 Python-GAS 연동 봇에 의해 발송되었습니다.";

    MailApp.sendEmail(myEmail, subject, body);
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

// [GAS 배포 단계]
// 1. script.google.com 접속 -> 새 프로젝트 생성
// 2. 위 코드 복사 & 붙여넣기 (myEmail 부분 수정)
// 3. 상단 '배포' -> '새 배포' 클릭
// 4. 유형 선택: '웹 앱'
// 5. 설명 입력 / 다음 사용자로 실행: '나' / 액세스 권한: '모든 사용자' (중요!)
// 6. '배포' 클릭 후 생성된 '웹 앱 URL'을 복사해서 파이썬 .env의 GAS_WEBHOOK_URL에 입력
"""

