"""Collect linked opportunities from official university and scholarship indexes."""

import re
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import parse_qsl, unquote, urlencode, urljoin, urlsplit, urlunsplit


SOURCES = [
    {"id": "hku-ece", "name": "HKU · Engineering admissions", "url": "https://sweb.hku.hk/tola/servlet/CreateCurriculumListScreen/insertForm"},
    {"id": "hku-mech", "name": "HKU · Mechanical Engineering", "url": "https://mech.hku.hk/tpg/"},
    {"id": "southampton", "name": "Southampton · Electrical and electronic engineering", "url": "https://www.southampton.ac.uk/study/subjects/electrical-electronic-engineering"},
    {"id": "kth-programmes", "name": "KTH · Master's programmes", "url": "https://www.kth.se/en/studies/master/programmes"},
    {"id": "kth-scholarships", "name": "KTH · Master's scholarships", "url": "https://www.kth.se/en/studies/master/admissions/scholarships/scholarship-opportunities-for-master-s-studies-1.860447"},
    {"id": "commonwealth", "name": "Commonwealth Scholarship Commission", "url": "https://cscuk.fcdo.gov.uk/scholarships/"},
]

INSTITUTIONS = {
    "hku-ece": ("The University of Hong Kong", "Hong Kong"),
    "hku-mech": ("The University of Hong Kong", "Hong Kong"),
    "southampton": ("University of Southampton", "United Kingdom"),
    "kth-programmes": ("KTH Royal Institute of Technology", "Sweden"),
    "kth-scholarships": ("KTH Royal Institute of Technology", "Sweden"),
    "commonwealth": ("Commonwealth Scholarship Commission in the UK", "United Kingdom"),
}

RESULT_HOSTS = {
    "hku-ece": {"sweb.hku.hk", "portal.hku.hk", "admissions.hku.hk"},
    "hku-mech": {"mech.hku.hk", "portal.hku.hk", "admissions.hku.hk"},
    "southampton": {"www.southampton.ac.uk", "southampton.ac.uk"},
    "kth-programmes": {"www.kth.se", "kth.se"},
    "kth-scholarships": {"www.kth.se", "kth.se"},
    "commonwealth": {"cscuk.fcdo.gov.uk"},
}

# Label and match the discipline using the programme's own title. More specific
# matches come first. Keep unrelated degrees off the desk when an index is broad.
FIELDS = [
    ("IC design", r"integrated circuit|vlsi|system.on.chip|analogue and digital"),
    ("Microelectronics", r"micro[ -]?electronics?|semiconductor|nanoelectronics?"),
    ("Embedded systems", r"embedded|internet of things|wearable|e-textiles"),
    ("Nanotechnology", r"nanotechnolog|nanoscience"),
    ("Electronics", r"electronic|electromechanical"),
    ("Photonics and optics", r"photonic|optical engineering|optoelectric"),
    ("Communications", r"wireless|communication engineering|communications engineering"),
    ("Electrical systems", r"electric(?:al)? (?:power|network)|smart electrical"),
    ("Control and signal processing", r"signal processing|control and robotics|control systems|mechatronic"),
]


def plain(text):
    return " ".join(text.split())


class IndexPage(HTMLParser):
    """Collect anchors, their nearest preceding heading, and visible date text."""

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.words = []
        self._hidden = 0
        self._anchor = None
        self._heading_tag = None
        self._heading_parts = []
        self._last_heading = ""
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "template"}:
            self._hidden += 1
        if self._hidden:
            return
        if tag in {"h1", "h2", "h3", "h4"}:
            self._heading_tag = tag
            self._heading_parts = []
        if tag == "a":
            attrs = dict(attrs)
            self._anchor = (attrs.get("href") or "", attrs.get("aria-label") or attrs.get("title") or "", [])

    def handle_data(self, data):
        if self._hidden:
            return
        self.words.append(data)
        if self._anchor:
            self._anchor[2].append(data)
        if self._heading_tag:
            self._heading_parts.append(data)

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "template"}:
            self._hidden = max(0, self._hidden - 1)
            return
        if self._hidden:
            return
        if tag == "a" and self._anchor:
            href, fallback, parts = self._anchor
            title = plain("".join(parts)) or plain(fallback)
            self.links.append((href, title, self._last_heading))
            self._anchor = None
        if tag == self._heading_tag:
            self._last_heading = plain("".join(self._heading_parts))
            self._heading_tag = None


def official_url(source, href):
    if not href.strip() or href.startswith("#"):
        return None
    try:
        parts = urlsplit(urljoin(source["url"], href.strip()))
        if (parts.scheme != "https" or parts.hostname not in RESULT_HOSTS[source["id"]]
                or parts.username or parts.password or parts.port not in (None, 443)):
            return None
    except ValueError:
        return None
    # HKU uses its query string to identify individual programmes.
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
    return urlunsplit(("https", parts.hostname, parts.path, urlencode(query, safe="()"), ""))


def field_for(title):
    return next((name for name, pattern in FIELDS if re.search(pattern, title, re.I)), None)


def course_record(source_id, url, label, heading):
    path = urlsplit(url).path.lower().rstrip("/")
    title = label
    if source_id == "southampton":
        if not re.fullmatch(r"/courses/[a-z0-9-]+-(?:masters-)?msc", path):
            return None
        if label.lower().startswith(("find out more", "learn more", "read more")):
            # Southampton course cards put the title in h3 and a generic link below it.
            title = heading
            longest = sorted(re.findall(r"[a-z]{4,}", title.lower()), key=len, reverse=True)
            if not any(word in path for word in longest[:2]):
                return None
    elif source_id == "hku-ece":
        if not re.search(r"(?:msc\s*\(eng\)|master of science in engineering)", title, re.I):
            return None
        if urlsplit(url).hostname not in {"portal.hku.hk", "admissions.hku.hk"}:
            return None
    elif source_id == "hku-mech":
        # The postgraduate index links degree titles twice, with and without their acronym.
        if not re.fullmatch(r"/[a-z][a-z0-9-]*", path) or re.search(r"\b(?:staff|department|research|laboratory)\b", title, re.I):
            return None
    elif source_id == "kth-programmes":
        if not re.search(r"/master/[a-z0-9-]+(?:/msc-[a-z0-9.-]+)?$", path):
            return None
        if re.search(r"\b(browse|all programmes|study at|admission|requirements)\b", title, re.I):
            return None
    field = field_for(title)
    if not field or not 3 <= len(title) <= 145:
        return None
    return {"title": title, "kind": "program", "field": field}


def scholarship_record(source_id, url, label):
    path = urlsplit(url).path.lower()
    if source_id == "commonwealth":
        if not path.startswith("/scholarships/") or not re.fullmatch(
            r"Commonwealth (?:.*Master[’']?s|Shared|Distance Learning) Scholarships?", label, re.I
        ):
            return None
        summary = "Check the scheme’s eligible countries, participating courses and application process with the Commission."
    else:
        if "/master/admissions/scholarships/" not in path or not re.fullmatch(r"KTH [\w -]*Scholarship", label, re.I):
            return None
        summary = "Check the award’s programme, fee status and application requirements at KTH."
        if "one-year" in label.lower():
            summary = "Second-year funding for students already enrolled in a KTH master’s programme."
        elif "joint" in label.lower():
            summary = "For selected joint master’s programmes. Check the eligible programmes at KTH."
        elif "india" in label.lower():
            summary = "A KTH master’s scholarship for applicants from India. Check the citizenship, fee and programme conditions."
    return {"title": label, "kind": "scholarship", "field": "Master’s funding", "summary": summary}


_FULL_DATE = r"\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}"


def scholarship_deadline(source_id, html):
    text = plain(" ".join(IndexPage(html).words))
    if source_id == "kth-scholarships":
        pattern = rf"\b({_FULL_DATE})\s*:\s*applications? closes?\b"
    else:
        pattern = rf"\bclosing date for applications (?:is|was)\s+(?:\d{{1,2}}:\d{{2}}\s+(?:GMT|BST|UTC)\s+on\s+)?(?:[A-Za-z]+day\s+)?({_FULL_DATE})\b"
    dates = set(re.findall(pattern, text, flags=re.I))
    if len(dates) != 1:
        return None
    try:
        return datetime.strptime(dates.pop().title(), "%d %B %Y").date().isoformat()
    except ValueError:
        return None


# Use the provider's programme pages as durable links when a stream has more
# than one application entry (e.g. full-time and part-time).
HKU_PROGRAMME_PAGES = {
    "integrated circuits and electronic systems": "https://portal.hku.hk/tpg-admissions/programme-details?mode=0&programme=master-of-science-in-engineering-(integrated-circuits-and-electronic-systems)-engg",
    "general stream": "https://portal.hku.hk/tpg-admissions/programme-details?mode=0&programme=master-of-science-in-engineering-(electrical-and-electronic-engineering)-general-stream-engg",
    "power engineering stream": "https://portal.hku.hk/tpg-admissions/programme-details?mode=0&programme=master-of-science-in-engineering-(electrical-and-electronic-engineering)-power-engineering-stream-engg",
    "communications engineering stream": "https://portal.hku.hk/tpg-admissions/programme-details?mode=0&programme=master-of-science-in-engineering-(electrical-and-electronic-engineering)-communications-engineering-stream-engg"
}


def hku_admissions(source, page):
    rows = {}
    for href, label, _ in page.links:
        if not re.fullmatch(r"full[ -]time", label.strip(), re.I):
            continue
        url = urljoin(source["url"], href)
        parts = urlsplit(url)
        if (parts.scheme != "https" or parts.hostname != "sweb.hku.hk" or
                parts.path.lower() != "/tola/html/dr/frontpage/instruction.htm"):
            continue
        descriptor = unquote(parts.query).replace("_", " ").split(";")
        if len(descriptor) < 2 or descriptor[0].strip() != "Faculty of Engineering":
            continue
        title = plain(descriptor[1])
        if not title.lower().startswith("master of science in engineering"):
            continue
        # MEST has its own dedicated official departmental index on this desk.
        if "microelectronics science and technology" in title.lower():
            continue
        field = field_for(title)
        if not field:
            continue
        short_title = plain(re.sub(r"\[MSc\(Eng\)\(([^)]+)\)\]", r" (\1) ", title, flags=re.I))
        short_title = re.sub(r"^Master of Science in Engineering in ", "MSc(Eng) in ", short_title, flags=re.I)
        for marker, programme_url in HKU_PROGRAMME_PAGES.items():
            if marker in title.lower():
                if marker.endswith("stream") and "electrical and electronic engineering" not in title.lower():
                    continue
                url = programme_url
                break
        rows[url] = {"title": short_title, "kind": "program", "field": field, "url": url,
                     "institution": "The University of Hong Kong", "country": "Hong Kong"}
    # Closed and future rounds can be listed as text, without an application link.
    # Record catalogue presence only; the listing itself does not establish an open round.
    visible = plain(" ".join(page.words))
    visible = re.sub(r"\[\s*MSc\s*\(Eng\)\s*\([^)]+\)\s*\]", " ", visible, flags=re.I)
    confirmed = {}
    if re.search(r"Master of Science in Engineering in Integrated Circuits and Electronic Systems\b", visible, re.I):
        confirmed["integrated circuits and electronic systems"] = "MSc(Eng) in Integrated Circuits and Electronic Systems (ICES)"
    for name in re.findall(r"Electrical and Electronic Engineering\s+(General Stream|Power Engineering Stream|Communications Engineering Stream)\b", visible, re.I):
        confirmed[name.lower()] = f"MSc(Eng) in Electrical and Electronic Engineering (EEE) – {name}"
    for marker, title in confirmed.items():
        url = HKU_PROGRAMME_PAGES[marker]
        rows.setdefault(url, {"title": title, "kind": "program", "field": field_for(title), "url": url,
                              "institution": "The University of Hong Kong", "country": "Hong Kong"})
    return rows


def fetch_source(source, fetch_text):
    """Fetch one permitted index. Return distinct listings; propagate retrieval errors.

    Dates appear only for unambiguous application-closing statements naming a year.
    Ads, other institutions, unscoped scholarship articles, and unrelated degrees
    are excluded. Source IDs/URLs must be registered together in SOURCES.
    """
    registered = next((s for s in SOURCES if s["id"] == source["id"] and s["url"] == source["url"]), None)
    if not registered:
        raise ValueError("Unknown opportunity source")
    source_id = registered["id"]
    institution, country = INSTITUTIONS[source_id]
    scholarship = source_id in {"commonwealth", "kth-scholarships"}
    page = IndexPage(fetch_text(registered["url"]))
    records = hku_admissions(registered, page) if source_id == "hku-ece" else {}
    for href, label, heading in page.links:
        url = official_url(registered, href)
        if not url or url in records:
            continue
        if scholarship:
            row = scholarship_record(source_id, url, label)
        else:
            row = course_record(source_id, url, label, heading)
        if row:
            records[url] = {**row, "url": url, "institution": institution, "country": country}
    if scholarship:
        for url, row in records.items():
            deadline = scholarship_deadline(source_id, fetch_text(url))
            if deadline:
                row["deadline"] = deadline
    return list(records.values())
