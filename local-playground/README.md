# MediaPipe Kids Playground — 로컬 실행

이 폴더만 있으면 Stretch It 튜토리얼과 8개 Explore 장난감을 로컬에서 실행할 수 있습니다. 별도 설치나 빌드는 필요 없고, Python 3와 인터넷 연결이 필요합니다. 인터넷은 처음 카메라를 켤 때 MediaPipe 런타임과 모델을 불러오는 데 사용합니다.

## 가장 쉬운 실행 방법

### Mac

1. `start.command`를 더블클릭합니다.
2. macOS가 처음 실행을 막으면 파일을 우클릭한 뒤 **열기**를 선택합니다.
3. 브라우저가 열리면 **카메라 켜기**를 누르고 카메라 사용을 허용합니다.

### Windows

1. Python 3가 없다면 [python.org](https://www.python.org/downloads/)에서 설치하면서 **Add Python to PATH**를 선택합니다.
2. `start.bat`을 더블클릭합니다.
3. 브라우저가 열리면 **카메라 켜기**를 누르고 카메라 사용을 허용합니다.

### 터미널에서 실행

이 폴더에서 다음 명령을 실행합니다.

```bash
python3 serve.py
```

Windows에서 `python3`가 없다면 다음을 사용합니다.

```powershell
py serve.py
```

브라우저는 자동으로 `http://127.0.0.1:8000/kids/`을 엽니다. 8000번 포트를 다른 프로그램이 사용 중이면 빈 포트를 자동으로 골라 엽니다. 종료할 때는 실행 중인 터미널에서 `Ctrl+C`를 누르거나 터미널 창을 닫습니다.

## 왜 HTML 파일을 바로 열면 안 되나요?

브라우저는 `file://`로 연 페이지의 카메라 사용과 JavaScript 모듈을 제한합니다. `serve.py`가 만드는 `localhost` 주소는 브라우저가 카메라 사용을 허용하는 안전한 로컬 환경입니다.

## 수업 중 문제 해결

- 카메라가 안 켜지면 주소창 옆 카메라 아이콘에서 권한을 **허용**으로 바꾸고 다시 시도합니다.
- Zoom이나 다른 앱이 카메라를 단독 사용 중이라면 해당 앱의 카메라를 잠시 끕니다.
- 그래도 안 되면 화면의 **손 없이 해보기**를 눌러 데모 슬라이더로 참여합니다.
- 화면이 오래 멈추면 인터넷 연결을 확인한 뒤 새로고침합니다. MediaPipe 모델은 외부에서 한 번 불러옵니다.
- Chrome 또는 Edge 최신 버전을 권장합니다.

## 폴더 구조

```text
local-playground/
├── README.md       이 사용설명서
├── serve.py        로컬 서버와 브라우저 실행
├── start.command   Mac 더블클릭 실행
├── start.bat       Windows 더블클릭 실행
├── index.html      /kids/로 이동
├── kids/           학생용 화면, 컨트롤, 폰트
└── lib/            MediaPipe tracker, signals, landmarks
```

`local-playground` 폴더 전체를 복사하거나 ZIP으로 전달하면 됩니다. 일부 파일만 빼면 실행되지 않을 수 있습니다.

