import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

export class AppErrorBoundary extends Component<{ children: ReactNode; app: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Stellar] ${this.props.app} crashed`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash-screen">
          <div className="crash-orb"><TriangleAlert size={26} /></div>
          <h3>{this.props.app} 暂时失联</h3>
          <p>{this.state.error.message || '应用遇到了未处理的问题。'}</p>
          <button className="btn primary" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={14} /> 重新挂载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
