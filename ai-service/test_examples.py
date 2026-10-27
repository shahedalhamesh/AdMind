import knowledge

knowledge.add_example(1, 1, 101, "اكتبي بوست عن أسعار القهوة", "اسبريسو 10 ولاتيه 15")
knowledge.add_example(1, 1, 102, "اكتبي بوست عن موعد الافتتاح", "نفتح الأسبوع القادم")

for q in ["بوست عن أسعار المشروبات", "إعلان عن تاريخ الافتتاح"]:
    top = knowledge.search_examples(1, 1, q)[0]
    print(q, "->", "episode", top["episode_id"], top["score"])

# Same episode twice must not duplicate
knowledge.add_example(1, 1, 101, "اكتبي بوست عن أسعار القهوة", "اسبريسو 10 ولاتيه 15")
print("count (expect 2):", len(knowledge.search_examples(1, 1, "بوست", limit=10)))

# Another client must not see them
print("other client (expect 0):", len(knowledge.search_examples(1, 3, "بوست", limit=10)))

knowledge.remove_example(1, 101)
knowledge.remove_example(1, 102)
print("after remove (expect 0):", len(knowledge.search_examples(1, 1, "بوست", limit=10)))

knowledge._client().close()