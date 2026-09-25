# Peppercorn Capital (웹 페이지)

Apps Script 웹앱의 데이터(JSON)를 불러와 보여주는 정적 페이지입니다.
Google의 "Google Apps Script 사용자가 만들었습니다" 안내 배너가 나오지 않고, 홈 화면 아이콘도 정상 적용됩니다.

## 배포 (GitHub Pages)
1. GitHub에서 새 저장소 만들기 (예: bull-pepper) — Public
2. 이 폴더의 파일 전체 업로드 (Add file ▸ Upload files)
3. Settings ▸ Pages ▸ Source: Deploy from a branch ▸ main / (root) ▸ Save
4. 1~2분 후 https://<아이디>.github.io/bull-pepper/ 접속

## 필요 조건
- Apps Script 웹앱 배포: 실행 = 나, 액세스 권한 = **모든 사용자** (익명 접근 허용)
- index.html 의 `API_URL` = 배포 관리의 /exec 주소 (배포 주소가 바뀌면 여기만 수정)
