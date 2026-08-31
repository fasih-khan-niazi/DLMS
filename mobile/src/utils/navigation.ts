/** Navigate from Activity / nested screens to the Catalog tab. */
export function goToCatalogTab(navigation: { navigate: (...args: any[]) => void; getParent?: () => any }) {
  const tryNav = (nav: any) => {
    if (!nav?.navigate) return false;
    try {
      nav.navigate("Catalog");
      return true;
    } catch {
      return false;
    }
  };

  if (tryNav(navigation)) return;
  const parent = navigation.getParent?.();
  if (tryNav(parent)) return;
  const root = parent?.getParent?.();
  tryNav(root);
}
