/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import { MainApp } from "./components/MainApp";

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#FFF5F7] text-slate-800 font-sans selection:bg-rose-200">
        <MainApp />
      </div>
    </AuthProvider>
  );
}
