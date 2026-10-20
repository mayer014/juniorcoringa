import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contato">
      <div className="shell site-footer__grid">
        <div>
          <Image
            className="site-footer__logo"
            src="/images/logo-junior-coringa.webp"
            width={230}
            height={136}
            alt="Vereador Junior Coringa"
          />
          <p>Trabalho, escuta e compromisso com Campo Grande.</p>
        </div>

        <div>
          <span className="footer-label">Localização</span>
          <p className="footer-line">
            <MapPin size={18} /> Câmara Municipal de Campo Grande — MS
          </p>
        </div>

        <div>
          <span className="footer-label">Acompanhe</span>
          <Link href="/noticias" className="footer-link">
            Notícias e projetos <ArrowUpRight size={17} />
          </Link>
          <Link href="/atuacao-legislativa" className="footer-link">
            Atuação legislativa <ArrowUpRight size={17} />
          </Link>
          <Link href="/admin/login" className="footer-admin">
            Área administrativa
          </Link>
        </div>
      </div>
      <div className="shell site-footer__bottom">
        <span>© {new Date().getFullYear()} Vereador Junior Coringa</span>
        <span>Campo Grande, Mato Grosso do Sul</span>
      </div>
    </footer>
  );
}
