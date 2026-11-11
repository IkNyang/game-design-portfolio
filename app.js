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
  const frame = element('iframe');
  let selected = 0;
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
    frame.title = project.title + ' ' + doc.title;
    if (frame.getAttribute('src') !== doc.path) frame.src = doc.path;
  }
  details.addEventListener('toggle', () => {
    summary.textContent = details.open ? '기획서 접기' : '더보기 · 기획서 PDF';
    if (details.open) showDocument();
  });
  header.append(tabs, external);
  reader.append(header, frame);
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
