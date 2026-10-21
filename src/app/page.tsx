import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, HeartHandshake, MessagesSquare, Newspaper, Sparkles } from "lucide-react";
import { MandateGallery } from "@/components/mandate-gallery";
import { LegislativeCard } from "@/components/legislative-card";
import { PostCard } from "@/components/post-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listLegislativeItems, listPublishedGalleryItems, listPublishedPosts, listPublishedPostSummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const posts = listPublishedPosts(6);
  const featuredPost = posts[0];
  const remainingPosts = posts.slice(1, 4);
  const legislativeItems = listLegislativeItems({ limit: 3 });
  const managedGalleryPhotos = listPublishedGalleryItems(16).map((item) => ({
    src: item.imageUrl,
    alt: item.title || item.caption || item.postTitle || "Registro do mandato",
    href: item.postSlug ? `/noticias/${item.postSlug}` : "",
    category: item.postSlug ? "Matéria relacionada" : "Galeria",
  }));
  const fallbackGalleryPhotos = listPublishedPostSummaries(60)
    .filter((post): post is typeof post & { coverImage: string } => Boolean(post.coverImage))
    .filter((post, index, items) => items.findIndex((item) => item.coverImage === post.coverImage) === index)
    .map((post) => ({
      src: post.coverImage,
      alt: post.title,
      href: `/noticias/${post.slug}`,
      category: post.category,
    }));
  const managedSources = new Set(managedGalleryPhotos.map((photo) => photo.src));
  const galleryPhotos = [
    ...managedGalleryPhotos,
    ...fallbackGalleryPhotos.filter((photo) => !managedSources.has(photo.src)),
  ].slice(0, 16);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="shell hero__inner">
            <div className="hero__content">
              <div className="eyebrow"><span /> Vereador de Campo Grande — MS</div>
              <h1>
                Presença que <em>escuta.</em><br />
                Trabalho que <strong>transforma.</strong>
              </h1>
              <p className="hero__lead">
                Um mandato próximo das pessoas, comprometido com a inclusão e com ações que melhoram a vida de quem vive em Campo Grande.
              </p>
              <div className="hero__actions">
                <Link className="button" href="/noticias">
                  Acompanhe o mandato <ArrowRight size={19} />
                </Link>
                <Link className="button button--ghost" href="#mandato">
                  Conheça o Junior <ArrowDown size={18} />
                </Link>
              </div>
              <div className="hero__trust">
                <span><Check size={15} /> Transparência</span>
                <span><Check size={15} /> Participação</span>
                <span><Check size={15} /> Inclusão</span>
              </div>
            </div>

            <div className="hero__portrait">
              <div className="hero__halo" />
              <div className="hero__tag hero__tag--one"><Sparkles size={17} /> Aqui trabalha</div>
              <div className="hero__tag hero__tag--two"><HeartHandshake size={17} /> Inclusão é prioridade</div>
              <Image
                src="/images/junior-coringa-corpo-inteiro.webp"
                alt="Vereador Junior Coringa"
                width={800}
                height={1200}
                priority
                sizes="(max-width: 850px) 80vw, 46vw"
              />
            </div>
          </div>
          <div className="hero__ticker" aria-hidden="true">
            <div>
              <span>TRABALHO</span><i />
              <span>RESPEITO</span><i />
              <span>INCLUSÃO</span><i />
              <span>CAMPO GRANDE</span><i />
              <span>TRABALHO</span><i />
              <span>RESPEITO</span><i />
              <span>INCLUSÃO</span><i />
            </div>
          </div>
        </section>

        <section className="section mandate" id="mandato">
          <div className="shell mandate__grid">
            <div className="mandate__visual">
              <div className="mandate__frame">
                <Image
                  src="/images/junior-coringa-retrato.webp"
                  alt="Junior Coringa, vereador de Campo Grande"
                  width={720}
                  height={1040}
                  sizes="(max-width: 850px) 90vw, 42vw"
                />
              </div>
              <div className="infinity-mark" aria-label="Símbolo da neurodiversidade">∞</div>
            </div>

            <div className="mandate__copy">
              <div className="eyebrow eyebrow--dark"><span /> Um mandato perto de você</div>
              <h2>Política se faz com <em>escuta</em> e trabalho de verdade.</h2>
              <p>
                Junior Coringa é vereador de Campo Grande e defensor da causa do autismo. Seu mandato coloca as pessoas no centro das decisões, com diálogo, respeito e atuação presente na cidade.
              </p>
              <p>
                Este é o espaço para acompanhar projetos, ações, agendas e notícias — de forma direta e transparente.
              </p>
              <Link href="/noticias" className="text-link text-link--large">
                Ver o trabalho acontecendo <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        <section className="section causes" id="bandeiras">
          <div className="shell">
            <div className="section-heading section-heading--center">
              <div className="eyebrow"><span /> Nossas bandeiras</div>
              <h2>Compromissos que orientam <em>cada ação.</em></h2>
              <p>Prioridades construídas com quem vive a realidade de Campo Grande todos os dias.</p>
            </div>

            <div className="causes__grid">
              <article className="cause-card cause-card--primary">
                <span className="cause-card__number">01</span>
                <div className="cause-card__icon"><HeartHandshake /></div>
                <h3>Autismo, inclusão e respeito</h3>
                <p>Uma cidade mais acolhedora começa com direitos, informação, acessibilidade e oportunidades para todas as pessoas.</p>
                <div className="spectrum-line"><i /><i /><i /><i /></div>
              </article>
              <article className="cause-card">
                <span className="cause-card__number">02</span>
                <div className="cause-card__icon"><MessagesSquare /></div>
                <h3>Mandato participativo</h3>
                <p>Ouvir bairros, famílias e comunidades para transformar necessidades reais em atuação pública.</p>
              </article>
              <article className="cause-card">
                <span className="cause-card__number">03</span>
                <div className="cause-card__icon"><Newspaper /></div>
                <h3>Transparência sempre</h3>
                <p>Comunicação clara para que cada cidadão acompanhe projetos, posicionamentos e resultados do mandato.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section latest" id="noticias">
          <div className="shell">
            <div className="section-heading section-heading--split">
              <div>
                <div className="eyebrow eyebrow--dark"><span /> Acompanhe de perto</div>
                <h2>Notícias e <em>projetos</em></h2>
              </div>
              <Link href="/noticias" className="button button--outline">
                Ver todas <ArrowRight size={18} />
              </Link>
            </div>

            {posts.length ? (
              <div className="latest__grid">
                {featuredPost && <PostCard post={featuredPost} featured />}
                <div className="latest__side">
                  {remainingPosts.map((post) => <PostCard key={post.id} post={post} />)}
                </div>
              </div>
            ) : (
              <div className="news-empty">
                <div className="news-empty__mark">JC</div>
                <div>
                  <span>Em breve</span>
                  <h3>As primeiras notícias do mandato serão publicadas aqui.</h3>
                  <p>A área administrativa já está pronta para receber matérias, projetos e agendas.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="section chamber-now" id="atuacao-legislativa">
          <div className="shell">
            <div className="section-heading section-heading--split">
              <div>
                <div className="eyebrow"><span /> Dados oficiais</div>
                <h2>Agora na <em>Câmara</em></h2>
                <p>Indicações, projetos em tramitação e resultados do mandato, direto do portal legislativo.</p>
              </div>
              <Link href="/atuacao-legislativa" className="button button--outline button--light-outline">
                Ver atuação completa <ArrowRight size={18} />
              </Link>
            </div>
            {legislativeItems.length ? (
              <div className="legislative-grid legislative-grid--home">
                {legislativeItems.map((item) => <LegislativeCard key={item.id} item={item} />)}
              </div>
            ) : (
              <div className="chamber-now__empty">Os primeiros dados oficiais aparecerão aqui após a sincronização com a Câmara.</div>
            )}
          </div>
        </section>

        <MandateGallery photos={galleryPhotos} />

        <section className="section cta-section">
          <div className="shell cta-card">
            <div className="cta-card__pattern" aria-hidden="true">∞</div>
            <div>
              <span className="cta-card__eyebrow">Sua voz importa</span>
              <h2>Um mandato feito com você.</h2>
              <p>Acompanhe as ações, compartilhe ideias e participe da construção de uma Campo Grande mais inclusiva.</p>
            </div>
            <Link href="#contato" className="button button--light">
              Fale com o mandato <ArrowRight size={19} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
