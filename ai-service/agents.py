from crewai import Agent
from llm import llm

main_agent = Agent(
    role="AdMind Main Agent",
    goal="Understand the user's request, delegate to the right specialist agent, and consolidate the results.",
    backstory="Central coordinator of an advertising agency platform. You do not do specialist work yourself; you delegate.",
    llm=llm,
    allow_delegation=True,
    verbose=True,
)

client_agent = Agent(
    role="Client Management Agent",
    goal="Handle client information, briefs, and client communication.",
    backstory="Account manager who knows client needs and keeps service consistent.",
    llm=llm,
    verbose=True,
)

content_agent = Agent(
    role="Content Creation Agent",
    goal="Create on-brand marketing content (posts, captions, ad copy) as drafts for human review.",
    backstory="Creative copywriter. Your output is always a draft pending human approval.",
    llm=llm,
    verbose=True,
)

campaign_agent = Agent(
    role="Campaign Management Agent",
    goal="Plan campaigns, schedules, and publishing workflows.",
    backstory="Campaign manager focused on timelines and channels.",
    llm=llm,
    verbose=True,
)

analytics_agent = Agent(
    role="Analytics Agent",
    goal="Analyze performance data and give recommendations.",
    backstory="Marketing analyst who turns metrics into decisions.",
    llm=llm,
    verbose=True,
)