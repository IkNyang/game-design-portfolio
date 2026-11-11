function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const lightbox = document.querySelector('.lightbox');
const zoomImage = lightbox.querySelector('img');
const zoomCaption = lightbox.querySelector('p');
lightbox.querySelector('button').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener('close', () => {
  zoomImage.removeAttribute('src');
});

function projectGallery(project) {
  const heading = element('div', 'gallery-head');
  heading.append(element('h3', '', '프로젝트 소개'));
  const controls = element('div', 'controls');
  const previous = element('button', 'control', '←');
  const next = element('button', 'control', '→');
  previous.setAttribute('aria-label', '이전 화면');
  next.setAttribute('aria-label', '다음 화면');
  const counter = element('output');
  controls.append(previous, counter, next);
  heading.append(controls);

  const gallery = element('div', 'gallery');
  gallery.tabIndex = 0;
  gallery.setAttribute('role', 'region');
  gallery.setAttribute('aria-label', project.title + ' 이미지 및 설명');
  const cards = project.panels.map(panel => {
    const card = element('article', 'panel');
    const media = element('div', 'media');
    panel.images.forEach((path, index) => {
      const enlarge = element('button', 'image-button');
      const label = panel.images.length > 1 ? panel.title + ' 이미지 ' + (index + 1) : panel.title;
      enlarge.setAttribute('aria-label', label + ' 확대');
      const photo = element('img');
      photo.src = path;
      photo.alt = label;
      photo.loading = 'lazy';
      photo.decoding = 'async';
      enlarge.append(photo);
      enlarge.addEventListener('click', () => {
        zoomImage.src = path;
        zoomImage.alt = label;
        zoomCaption.textContent = project.title + ' / ' + label;
        lightbox.showModal();
      });
      media.append(enlarge);
    });
    const copy = element('div', 'panel-copy');
    copy.append(element('h4', '', panel.title));
    panel.text.forEach(line => copy.append(element('p', '', line)));
    card.append(media, copy);
    gallery.append(card);
    return card;
  });

  let active = 0;
  let requested = null;
  const update = () => {
    counter.value = (active + 1) + ' / ' + cards.length;
    previous.disabled = active === 0;
    next.disabled = active === cards.length - 1;
  };
  const offset = card => card.offsetLeft - cards[0].offsetLeft;
  const move = direction => {
    const target = Math.max(0, Math.min(cards.length - 1, (requested ?? active) + direction));
    requested = target;
    gallery.scrollTo({left: offset(cards[target]), behavior: motion.matches ? 'instant' : 'smooth'});
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  gallery.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  gallery.addEventListener('scroll', () => {
    const position = gallery.scrollLeft;
    active = cards.reduce((closest, card, index) =>
      Math.abs(offset(card) - position) < Math.abs(offset(cards[closest]) - position) ? index : closest, 0);
    if (requested === active) requested = null;
    update();
  }, {passive: true});
  gallery.addEventListener('pointerdown', () => { requested = null; }, {passive: true});
  update();
  return [heading, gallery];
}

function projectDocuments(project) {
  const details = element('details', 'documents');
  const summary = element('summary', '', '더보기 · 기획서 PDF');
  const reader = element('div', 'reader');
  const header = element('div', 'reader-head');
  const tabs = element('div', 'doc-tabs');
  const external = element('a', '', 'PDF 전체 화면 ↗');
  external.target = '_blank';
  external.rel = 'noopener';
  const toolbar = element('div', 'pdf-toolbar');
  const back = element('button', 'control', '←');
  const forward = element('button', 'control', '→');
  back.setAttribute('aria-label', 'PDF 이전 페이지');
  forward.setAttribute('aria-label', 'PDF 다음 페이지');
  const pageLabel = element('output');
  const status = element('p', 'pdf-status');
  status.setAttribute('role', 'status');
  const surface = element('div', 'pdf-surface');
  toolbar.append(back, pageLabel, forward);
  let selected = 0;
  let page = 1;
  let documentPromise;
  let revision = 0;
  let loaded = -1;
  back.addEventListener('click', () => { page--; renderPage(); });
  forward.addEventListener('click', () => { page++; renderPage(); });
  const buttons = project.docs.map((doc, index) => {
    const button = element('button', '', doc.title);
    button.type = 'button';
    button.addEventListener('click', () => {
      selected = index;
      showDocument();
    });
    tabs.append(button);
    return button;
  });
  function showDocument() {
    const doc = project.docs[selected];
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)));
    external.href = doc.path;
    if (loaded !== selected) {
      loaded = selected;
      page = 1;
      documentPromise = import('./pdf.min.mjs').then(pdf => {
        pdf.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', location.href).href;
        return pdf.getDocument({url: doc.path, useSystemFonts: true, useWasm: false}).promise;
      });
    }
    renderPage();
  }
  async function renderPage() {
    const request = ++revision;
    back.disabled = forward.disabled = true;
    status.textContent = 'PDF를 불러오는 중입니다.';
    try {
      const pdf = await documentPromise;
      if (request !== revision) return;
      const sheet = await pdf.getPage(page);
      if (request !== revision) return;
      const width = Math.min(1080, Math.max(280, surface.clientWidth - 24));
      const initial = sheet.getViewport({scale: 1});
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const viewport = sheet.getViewport({scale: width / initial.width * ratio});
      const canvas = element('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = width + 'px';
      canvas.setAttribute('aria-label', project.docs[selected].title + ' ' + page + '페이지');
      await sheet.render({canvas, viewport}).promise;
      if (request !== revision) return;
      surface.replaceChildren(canvas);
      pageLabel.value = page + ' / ' + pdf.numPages;
      back.disabled = page === 1;
      forward.disabled = page === pdf.numPages;
      status.textContent = '';
    } catch (error) {
      if (request !== revision) return;
      surface.replaceChildren();
      status.textContent = '미리보기를 열 수 없습니다. PDF 전체 화면 링크를 이용해 주세요.';
      console.error(error);
    }
  }
  details.addEventListener('toggle', () => {
    summary.textContent = details.open ? '기획서 접기' : '더보기 · 기획서 PDF';
    if (details.open) showDocument();
  });
  header.append(tabs, external);
  reader.append(header, toolbar, status, surface);
  details.append(summary, reader);
  return details;
}

const contents = document.querySelector('.contents');
const navigation = document.querySelector('.project-nav');
const list = document.getElementById('projects');
const navLinks = new Map();
projects.forEach((project, index) => {
  const number = String(index + 1).padStart(2, '0');
  const destination = '#' + project.id;
  const entry = element('a');
  entry.href = destination;
  const contentsTitle = project.id === 'maple' ? project.title + ' ' + project.subtitle : project.title;
  entry.append(element('small', '', number), element('span', '', contentsTitle), element('span', '', '↘'));
  contents.append(entry);
  const shortcut = element('a', '', project.title);
  shortcut.href = destination;
  navigation.append(shortcut);
  navLinks.set(project.id, shortcut);

  const section = element('section', 'project reveal');
  section.id = project.id;
  const heading = element('header', 'project-heading');
  const headings = element('div');
  const title = element('h2', '', project.title);
  title.id = project.id + '-title';
  section.setAttribute('aria-labelledby', title.id);
  headings.append(title, element('p', 'subtitle', project.subtitle), element('p', 'meta', [project.genre, project.team].filter(Boolean).join(' / ')));
  heading.append(element('span', 'project-number', number), headings);
  const intent = element('details', 'intent');
  intent.append(element('summary', '', '설계 의도'));
  project.intent.forEach(line => intent.append(element('p', '', line)));
  section.append(heading, intent, ...projectGallery(project));
  if (project.id === 'ratd') {
    const play = element('a', 'play', 'RATD 웹에서 플레이 ↗');
    play.href = 'https://iknyang.itch.io/ratd-random-augment-tower-defence';
    play.target = '_blank';
    play.rel = 'noopener';
    section.append(play);
  }
  section.append(projectDocuments(project));
  list.append(section);
});

const reveal = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('ready');
    reveal.unobserve(entry.target);
  });
}, {rootMargin: '0px 0px -8% 0px'});
const sections = [...list.children];
sections.forEach(section => reveal.observe(section));
const current = () => {
  const boundary = navigation.getBoundingClientRect().height + 115;
  const active = sections.filter(section => section.getBoundingClientRect().top <= boundary).at(-1);
  navLinks.forEach((link, id) => {
    if (id === active?.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { current(); ticking = false; });
}, {passive: true});
current();
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior: 'instant'});
