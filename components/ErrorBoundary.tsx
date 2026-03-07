// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from "react";
interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 m-4 bg-red-50 border border-red-200 rounded text-red-800 overflow-auto">
                    <h2 className="font-bold text-lg mb-2">Something went wrong</h2>
                    <div className="text-sm font-mono whitespace-pre-wrap bg-white p-2 rounded border border-red-100">
                        {this.state.error?.message}
                        <div className="mt-2 text-xs text-gray-500">
                            See console for full details.
                        </div>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-bold uppercase transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
