const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-header-bg border-t border-header-border py-3 px-4 z-30">
      <div className="text-center text-sm text-muted-foreground">
        © {currentYear} Hospital Municipal São José. Todos os direitos reservados.
      </div>
    </footer>
  );
};

export default Footer;