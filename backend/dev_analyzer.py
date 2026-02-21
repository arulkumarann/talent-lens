"""
Dev Analyzer — GitHub + Resume + LLM Evaluation
=================================================
Analyzes developer candidates via GitHub GraphQL API,
resume PDF parsing, and Gemini LLM evaluation.
"""

import os
import io
import re
import json
import time
import requests
import tempfile
from typing import Dict, Optional, List

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

def _clean_env(key, default=""):
    """Read env var, strip whitespace and accidental quotes."""
    val = os.getenv(key, default) or default
    return val.strip().strip('"').strip("'")

GEMINI_API_KEY = _clean_env("GEMINI_API_KEY") or _clean_env("GOOGLE_API_KEY")
GEMINI_ASSESSMENT_MODEL = _clean_env("GEMINI_ASSESSMENT_MODEL", "gemini-2.5-flash")
GITHUB_TOKEN = _clean_env("GITHUB_TOKEN")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)


# ─── Gemini Helper ────────────────────────────────────────────────────────────

def _gemini_text(system: str, user: str, max_tokens: int = 4096,
                 retries: int = 3, json_mode: bool = False) -> str:
    for attempt in range(retries):
        try:
            config_args = dict(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.2,
            )
            if json_mode:
                config_args["response_mime_type"] = "application/json"
            response = gemini_client.models.generate_content(
                model=GEMINI_ASSESSMENT_MODEL,
                contents=user,
                config=types.GenerateContentConfig(**config_args),
            )
            text = response.text or ""
            if text:
                return text
            print(f"    [DevAnalyzer] Empty response (attempt {attempt+1}/{retries})")
        except Exception as e:
            print(f"    [DevAnalyzer] API error (attempt {attempt+1}/{retries}): {e}")
        if attempt < retries - 1:
            time.sleep(3 * (attempt + 1))
    return ""


def _parse_json(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    if "```json" in text:
        s = text.find("```json") + 7
        e = text.find("```", s)
        try:
            return json.loads(text[s:e].strip())
        except Exception:
            pass
    m = re.search(r'\{.*\}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


# ─── GitHub GraphQL Analysis ──────────────────────────────────────────────────

GITHUB_GRAPHQL_QUERY = """
query($login: String!) {
  user(login: $login) {
    name
    bio
    company
    location
    createdAt
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        name
        description
        stargazerCount
        forkCount
        primaryLanguage { name }
        updatedAt
        isFork
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
      }
    }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          description
          stargazerCount
          primaryLanguage { name }
          url
        }
      }
    }
  }
}
"""


def analyze_github(username: str) -> Optional[Dict]:
    """Fetch GitHub profile data via GraphQL API."""
    if not username or not GITHUB_TOKEN:
        print(f"  [GitHub] Skipping — {'no username' if not username else 'no GITHUB_TOKEN'}")
        return None

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        print(f"  [GitHub] Fetching profile for {username}...")
        resp = requests.post(
            "https://api.github.com/graphql",
            headers=headers,
            json={"query": GITHUB_GRAPHQL_QUERY, "variables": {"login": username}},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        if "errors" in data:
            print(f"  [GitHub] GraphQL errors: {data['errors']}")
            return None

        user = data.get("data", {}).get("user")
        if not user:
            print(f"  [GitHub] User '{username}' not found")
            return None

        # Process repos
        repos = user.get("repositories", {}).get("nodes", [])
        own_repos = [r for r in repos if not r.get("isFork", False)]
        total_stars = sum(r.get("stargazerCount", 0) for r in own_repos)

        # Top languages
        lang_count = {}
        for r in own_repos:
            lang = r.get("primaryLanguage", {})
            if lang and lang.get("name"):
                lang_count[lang["name"]] = lang_count.get(lang["name"], 0) + 1
        top_languages = sorted(lang_count.items(), key=lambda x: -x[1])[:8]

        # Pinned repos
        pinned = []
        for p in user.get("pinnedItems", {}).get("nodes", []):
            pinned.append({
                "name": p.get("name", ""),
                "description": p.get("description", ""),
                "stars": p.get("stargazerCount", 0),
                "language": (p.get("primaryLanguage") or {}).get("name", ""),
                "url": p.get("url", ""),
            })

        contribs = user.get("contributionsCollection", {})

        result = {
            "username": username,
            "name": user.get("name", ""),
            "bio": user.get("bio", ""),
            "company": user.get("company", ""),
            "location": user.get("location", ""),
            "created_at": user.get("createdAt", ""),
            "followers": user.get("followers", {}).get("totalCount", 0),
            "following": user.get("following", {}).get("totalCount", 0),
            "total_repos": user.get("repositories", {}).get("totalCount", 0),
            "own_repos": len(own_repos),
            "total_stars": total_stars,
            "top_languages": [{"language": l, "count": c} for l, c in top_languages],
            "pinned_repos": pinned,
            "contributions": {
                "total": contribs.get("contributionCalendar", {}).get("totalContributions", 0),
                "commits": contribs.get("totalCommitContributions", 0),
                "pull_requests": contribs.get("totalPullRequestContributions", 0),
                "issues": contribs.get("totalIssueContributions", 0),
                "repos_created": contribs.get("totalRepositoryContributions", 0),
            },
            "top_repos": [
                {
                    "name": r.get("name", ""),
                    "description": (r.get("description") or "")[:100],
                    "stars": r.get("stargazerCount", 0),
                    "forks": r.get("forkCount", 0),
                    "language": (r.get("primaryLanguage") or {}).get("name", ""),
                }
                for r in own_repos[:5]
            ],
        }

        print(f"  [GitHub] {username}: {result['total_repos']} repos, "
              f"{total_stars} stars, {result['contributions']['total']} contributions")
        return result

    except Exception as e:
        print(f"  [GitHub] Error fetching {username}: {e}")
        return None


# ─── Resume PDF Parsing ──────────────────────────────────────────────────────

def parse_resume(resume_url: str, candidate_name: str = "") -> Optional[Dict]:
    """Download a PDF resume and extract structured info via LLM."""
    if not resume_url:
        print(f"  [Resume] No resume URL for {candidate_name}")
        return None

    try:
        print(f"  [Resume] Downloading PDF for {candidate_name}...")
        resp = requests.get(resume_url, timeout=30)
        resp.raise_for_status()

        # Extract text from PDF
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(resp.content))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            resume_text = "\n".join(text_parts)
        except Exception as e:
            print(f"  [Resume] PDF parse error: {e}")
            resume_text = ""

        if not resume_text or len(resume_text) < 50:
            print(f"  [Resume] Could not extract meaningful text from PDF")
            return None

        print(f"  [Resume] Extracted {len(resume_text)} chars, analyzing...")

        system = (
            "You are an expert recruiter AI. Extract structured information from this resume. "
            "Return ONLY a valid JSON object. Be concise — 1-2 sentences max per field."
        )

        user_prompt = f"""Extract structured data from this resume. Return ONLY valid JSON:

{{
  "skills": ["skill1", "skill2", ...],
  "experience_years": <number or estimate>,
  "education": [
    {{ "degree": "...", "institution": "...", "year": "..." }}
  ],
  "work_experience": [
    {{ "title": "...", "company": "...", "duration": "...", "highlights": "1 sentence" }}
  ],
  "projects": [
    {{ "name": "...", "description": "1 sentence", "tech_stack": ["..."] }}
  ],
  "certifications": ["cert1", "cert2"],
  "summary": "2-3 sentence professional summary"
}}

RESUME TEXT:
{resume_text[:8000]}"""

        result_text = _gemini_text(system, user_prompt, max_tokens=4096, json_mode=True)
        if result_text:
            parsed = _parse_json(result_text)
            if parsed:
                print(f"  [Resume] Parsed: {len(parsed.get('skills', []))} skills, "
                      f"{parsed.get('experience_years', '?')} years experience")
                return parsed

    except Exception as e:
        print(f"  [Resume] Error processing resume for {candidate_name}: {e}")

    return None


# ─── LLM Evaluation ──────────────────────────────────────────────────────────

def evaluate_candidate(candidate: Dict, role: Dict,
                       github_data: Optional[Dict],
                       resume_data: Optional[Dict]) -> Dict:
    """Evaluate a developer candidate against a role using Gemini."""

    system = (
        "You are an expert technical recruiter AI. Evaluate this developer candidate "
        "against the role requirements. Be FAIR but thorough.\n"
        "SCORING GUIDELINES:\n"
        "- Average developer = overall_score 60-70\n"
        "- Good developer with solid portfolio = 70-80\n"
        "- Very talented with standout work = 80-90\n"
        "- Elite, world-class = 90+\n"
        "- HIRE >= 71, CONSIDER 41-70, REJECT <= 40\n"
        "KEEP ALL reasoning strings VERY SHORT — 1-2 sentences max. Be concise."
    )

    context = {
        "candidate": {
            "name": candidate.get("name", ""),
            "email": candidate.get("email", ""),
            "current_ctc": candidate.get("current_ctc", ""),
            "linkedin": candidate.get("linkedin", ""),
        },
        "role": {
            "name": role.get("name", ""),
            "jd": role.get("jd", ""),
            "ctc": role.get("ctc", ""),
        },
        "github": github_data or "No GitHub data available",
        "resume": resume_data or "No resume data available",
    }

    user_prompt = f"""Evaluate this developer candidate for the role. Return ONLY valid JSON:

{{
  "overall_rating": <float 1.0-5.0>,
  "overall_score": <int 20-100>,
  "metrics": {{
    "technical_depth": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "project_quality": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "experience_relevance": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "github_activity": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "skill_match": {{ "rating": <float>, "reasoning": "1-2 sentences" }},
    "overall_fit": {{ "rating": <float>, "reasoning": "1-2 sentences" }}
  }},
  "strengths": ["short", "short", "short"],
  "areas_for_improvement": ["short", "short"],
  "recommendation": {{
    "decision": "HIRE|CONSIDER|REJECT",
    "confidence": "HIGH|MEDIUM|LOW",
    "reasoning": "1-2 sentences"
  }},
  "detailed_feedback": {{
    "technical_assessment": "1-2 sentences",
    "culture_fit": "1 sentence",
    "growth_potential": "1 sentence",
    "salary_alignment": "1 sentence"
  }}
}}

THRESHOLDS: HIRE >= 71, CONSIDER 41-70, REJECT <= 40

CANDIDATE + ROLE DATA:
{json.dumps(context, indent=2, default=str)}"""

    try:
        print(f"  [Eval] Generating assessment for {candidate.get('name', 'unknown')}...")
        result_text = _gemini_text(system, user_prompt, max_tokens=4096, json_mode=True)

        if result_text:
            parsed = _parse_json(result_text)
            if parsed and isinstance(parsed, dict):
                score = parsed.get("overall_score", 50)
                decision = parsed.get("recommendation", {}).get("decision", "CONSIDER")
                print(f"  [Eval] {candidate.get('name', 'unknown')}: "
                      f"score={score}, decision={decision}")
                return parsed

    except Exception as e:
        print(f"  [Eval] Error evaluating {candidate.get('name', 'unknown')}: {e}")

    # Fallback
    return {
        "overall_rating": 3.0,
        "overall_score": 50,
        "metrics": {
            "technical_depth": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
            "project_quality": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
            "experience_relevance": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
            "github_activity": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
            "skill_match": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
            "overall_fit": {"rating": 3.0, "reasoning": "Could not fully evaluate"},
        },
        "strengths": ["Pending full evaluation"],
        "areas_for_improvement": ["Pending full evaluation"],
        "recommendation": {
            "decision": "CONSIDER",
            "confidence": "LOW",
            "reasoning": "Analysis incomplete — could not fully evaluate candidate.",
        },
        "detailed_feedback": {
            "technical_assessment": "Pending evaluation",
            "culture_fit": "Pending evaluation",
            "growth_potential": "Pending evaluation",
            "salary_alignment": "Pending evaluation",
        },
    }


# ─── Full Pipeline ────────────────────────────────────────────────────────────

def analyze_dev_candidate(candidate: Dict, role: Dict) -> Dict:
    """
    Run the full analysis pipeline for a developer candidate:
    1. GitHub GraphQL analysis
    2. Resume PDF parsing
    3. LLM evaluation
    """
    name = candidate.get("name", "unknown")
    print(f"\n  [DevAnalyzer] ── Analyzing {name} ──")

    # 1. GitHub
    github_data = analyze_github(candidate.get("github_username", ""))
    time.sleep(1)

    # 2. Resume
    resume_data = parse_resume(candidate.get("resume_url", ""), name)
    time.sleep(1)

    # 3. LLM evaluation
    evaluation = evaluate_candidate(candidate, role, github_data, resume_data)

    return {
        "github_analysis": github_data,
        "resume_analysis": resume_data,
        "evaluation": evaluation,
    }
