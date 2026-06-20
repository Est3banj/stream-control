import { createContext, useContext } from 'react';

interface UpgradeModalContextType {
  show: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
  show: () => {},
});

export const useUpgradeModal = () => useContext(UpgradeModalContext);
export default UpgradeModalContext;
