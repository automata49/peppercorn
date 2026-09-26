import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class AppErrorBoundary extends Component<{children:ReactNode},{error:Error|null}> {
  state:{error:Error|null}={error:null}

  static getDerivedStateFromError(error:Error){
    return {error}
  }

  componentDidCatch(error:Error,info:ErrorInfo){
    console.error('Peppercorn render error',error,info)
  }

  render(){
    if(this.state.error){
      return <main className="fatal-error">
        <div>
          <strong>Peppercorn Capital</strong>
          <h1>앱을 표시하지 못했습니다.</h1>
          <p>화면 데이터 처리 중 오류가 발생했습니다. 아래 진단 메시지를 남겨 두었고, 캐시를 우회해 다시 불러올 수 있습니다.</p>
          <code>{this.state.error.message||this.state.error.name}</code>
          <button onClick={async()=>{
            try{if('caches' in window){for(const key of await caches.keys())await caches.delete(key)}}catch{}
            const url=new URL(window.location.href)
            url.searchParams.set('reload',Date.now().toString())
            window.location.replace(url.toString())
          }}>캐시 우회해서 다시 불러오기</button>
        </div>
      </main>
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App/></AppErrorBoundary>
  </StrictMode>
)
