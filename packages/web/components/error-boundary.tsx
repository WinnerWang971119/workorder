'use client'

import { ReactNode, Component, ErrorInfo } from 'react'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-gray-600">
              An unexpected error occurred. Please try again or contact your team lead.
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.href = '/workorders'
              }}
            >
              Go Back
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
