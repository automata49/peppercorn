import { useEffect, useState } from 'react'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover'
import { FolioWordmark } from './FolioWordmark'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState(isInstalled)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => { setInstalled(true); setPrompt(null); setOpen(false) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function startInstall() {
    if (prompt) {
      setPrompt(null)
      await prompt.prompt()
      await prompt.userChoice
    } else {
      setOpen(true)
    }
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button className="install-trigger" onClick={event=>{event.preventDefault();void startInstall()}} aria-label="Folio xx 홈 화면에 설치">앱 설치</button>
    </PopoverTrigger>
      <PopoverContent className="install-dialog" side="bottom" align="end" sideOffset={10} collisionPadding={12} aria-label="Folio xx 설치 안내">
        <PopoverClose asChild><button className="install-close" aria-label="닫기">×</button></PopoverClose>
        <img className="install-icon" src="./folio-b-icon-192.png?v=b5" alt="Folio 아이콘" />
        <h2 className="sr-only">Folio xx</h2><FolioWordmark className="install-wordmark"/>
        <p className="install-description">홈 화면에 추가하면 앱처럼 바로 열 수 있습니다.</p>
        <ol>
          {isIOS ? <>
            <li>브라우저의 <strong>공유</strong> 버튼을 누르세요.</li>
            <li><strong>홈 화면에 추가</strong>를 선택하고 <strong>추가</strong>를 누르세요.</li>
          </> : <>
            <li>Chrome의 <strong>⋮ 메뉴</strong>를 누르세요.</li>
            <li><strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요.</li>
          </>}
        </ol>
        <p className="install-note">카카오톡에서 열었다면 우선 링크를 Chrome{isIOS ? ' 또는 Safari' : ''}에서 여세요.</p>
      </PopoverContent>
  </Popover>
}
