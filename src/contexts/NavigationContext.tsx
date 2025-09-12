'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationState {
  history: string[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface NavigationContextType extends NavigationState {
  goBack: () => string | null;
  goForward: () => string | null;
  navigateTo: (path: string) => void;
  reset: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    history: ['/'],
    currentIndex: 0,
    canGoBack: false,
    canGoForward: false,
  });

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
    setNavigationState({
      history: [pathname],
      currentIndex: 0,
      canGoBack: false,
      canGoForward: false,
    });
  }, []);

  // Update navigation state when pathname changes (only after mounted)
  useEffect(() => {
    if (!mounted) return;
    
    setNavigationState(prevState => {
      // Si estamos navegando a una nueva página (no volviendo)
      const currentPath = prevState.history[prevState.currentIndex];
      
      if (pathname !== currentPath) {
        // Es una nueva navegación, agregar al historial
        const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
        newHistory.push(pathname);
        const newIndex = newHistory.length - 1;
        
        return {
          history: newHistory,
          currentIndex: newIndex,
          canGoBack: newIndex > 0,
          canGoForward: false, // No hay forward cuando navegamos a nueva página
        };
      }
      
      return prevState;
    });
  }, [pathname, mounted]);

  const goBack = (): string | null => {
    if (!navigationState.canGoBack) return null;
    
    const newIndex = navigationState.currentIndex - 1;
    const targetPath = navigationState.history[newIndex];
    
    setNavigationState(prevState => ({
      ...prevState,
      currentIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true,
    }));
    
    return targetPath;
  };

  const goForward = (): string | null => {
    if (!navigationState.canGoForward) return null;
    
    const newIndex = navigationState.currentIndex + 1;
    const targetPath = navigationState.history[newIndex];
    
    setNavigationState(prevState => ({
      ...prevState,
      currentIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < prevState.history.length - 1,
    }));
    
    return targetPath;
  };

  const navigateTo = (path: string): void => {
    setNavigationState(prevState => {
      const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
      newHistory.push(path);
      const newIndex = newHistory.length - 1;
      
      return {
        history: newHistory,
        currentIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: false,
      };
    });
  };

  const reset = (): void => {
    setNavigationState({
      history: [mounted ? pathname : '/'],
      currentIndex: 0,
      canGoBack: false,
      canGoForward: false,
    });
  };

  const contextValue: NavigationContextType = {
    ...navigationState,
    goBack,
    goForward,
    navigateTo,
    reset,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}