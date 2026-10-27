import { Component } from 'react'
import type { ReactNode } from 'react'
import { GraphicsFallback } from './GraphicsFallback'

export class GraphicsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <GraphicsFallback /> : this.props.children
  }
}
