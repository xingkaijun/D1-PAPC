import React, { useState, useEffect } from 'react';
import { oneDrive, msalInstance } from '../lib/onedrive';
import { EventMessage, EventType } from '@azure/msal-browser';

export const OneDriveTest = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [account, setAccount] = useState<any>(null);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${msg}`]);

    useEffect(() => {
        addLog("Test Component Mounted");

        // Add Msal Event Callback to see what's happening internally
        const callbackId = msalInstance.addEventCallback((message: EventMessage) => {
            // Filter out noisy events if needed, but for debugging keep them
            if (message.eventType.indexOf('Failure') > -1) {
                addLog(`[MSAL ERROR] ${message.eventType}: ${JSON.stringify(message.error)}`);
            }
            if (message.eventType === EventType.LOGIN_SUCCESS || message.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
                addLog(`[MSAL SUCCESS] ${message.eventType}`);
            }
        });

        // Check initial status
        (async () => {
            try {
                const activeAcc = await oneDrive.getActiveAccount();
                if (activeAcc) {
                    setAccount(activeAcc);
                    addLog(`Detected active account: ${activeAcc.username}`);
                } else {
                    addLog("No active account detected.");
                }
            } catch (e: any) {
                addLog(`Init Check Error: ${e?.message}`);
            }
        })();

        return () => {
            if (callbackId) msalInstance.removeEventCallback(callbackId);
        };
    }, []);

    const handleLogin = async () => {
        addLog("Attempting Login...");
        try {
            const acc = await oneDrive.login();
            if (acc) {
                setAccount(acc);
                addLog(`Login Successful: ${acc.username}`);
            } else {
                addLog("Login returned null (User cancelled?)");
            }
        } catch (e: any) {
            addLog(`Login Exception: ${e?.message}`);
            console.error(e);
        }
    };

    const handleLogout = async () => {
        addLog("Logging out...");
        await oneDrive.logout();
        setAccount(null);
    };

    const handleTestGraph = async () => {
        addLog("Testing Graph API Call (List Projects)...");
        try {
            const res = await oneDrive.listProjects();
            addLog(`Success! Found ${res.length} items in AppFolder.`);
            addLog(JSON.stringify(res, null, 2));
        } catch (e: any) {
            addLog(`Graph Error: ${e?.message}`);
        }
    };

    return (
        <div className="p-10 max-w-4xl mx-auto font-mono text-sm">
            <h1 className="text-2xl font-bold mb-4">OneDrive Isolation Test</h1>

            <div className="mb-6 p-4 bg-slate-100 rounded-lg space-y-2">
                <div>
                    <span className="font-bold">Status: </span>
                    {account ? <span className="text-green-600 font-bold">CONNECTED ({account.username})</span> : <span className="text-red-500">DISCONNECTED</span>}
                </div>
                <div>
                    <span className="font-bold">Client ID: </span> {import.meta.env.VITE_MSAL_CLIENT_ID}
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                {!account ? (
                    <button onClick={handleLogin} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Login Popup
                    </button>
                ) : (
                    <>
                        <button onClick={handleTestGraph} className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
                            Test Graph API
                        </button>
                        <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                            Logout
                        </button>
                    </>
                )}
            </div>

            <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto whitespace-pre-wrap">
                {logs.length === 0 && <div className="text-gray-500 italic">Waiting to start...</div>}
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </div>
    );
};
