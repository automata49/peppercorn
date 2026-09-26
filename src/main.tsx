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
          <p>새 버전 로딩 중 오류가 발생했습니다. 아래 버튼으로 앱을 다시 불러오세요.</p>
          <button onClick={()=>window.location.reload()}>다시 불러오기</button>
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
