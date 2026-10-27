import knowledge

knowledge.add_document(
    1, 1, "Menu",
    "لاتيه 15 ريال. كابتشينو 14 ريال. اسبريسو 10 ريال. القهوة المقطرة V60 بسعر 18 ريال. "
    "جميع المشروبات متوفرة بحليب الشوفان بإضافة 3 ريال.",
)
knowledge.add_document(
    1, 1, "Opening hours",
    "نفتح أبوابنا من الساعة السابعة صباحاً حتى الحادية عشرة مساءً طوال أيام الأسبوع. "
    "يوم الجمعة نبدأ العمل بعد الصلاة.",
)
knowledge.add_document(
    1, 3, "Rings",
    "خواتم الألماس من الذهب عيار 18. تبدأ الأسعار من 5000 ريال. نقدم ضمان مدى الحياة على جميع القطع.",
)

tests = [
    (1, 1, "كم سعر اللاتيه؟"),
    (1, 1, "متى بتفتحوا؟"),
    (1, 3, "كم سعر اللاتيه؟"),
]
for company, client, query in tests:
    print(f"\n== client {client}: {query}")
    for r in knowledge.search(company, client, query):
        print(f"  {r['score']}  [{r['title']}]")