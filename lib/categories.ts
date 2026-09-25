export type Category = { number: number; slug: string; name: string };

export function categoryFromFolderName(categories: Category[], folderName: string): Category {
  const match = /^(\d{2})-(.+)$/.exec(folderName);
  if (!match) throw new Error(`Invalid category folder name: "${folderName}"`);

  const number = Number(match[1]);
  const category = categories.find((c) => c.number === number);
  if (!category) throw new Error(`Unknown category number ${number} in folder "${folderName}"`);

  const expected = `${String(category.number).padStart(2, "0")}-${category.slug}`;
  if (folderName !== expected) {
    throw new Error(`Folder "${folderName}" doesn't match category ${number}'s expected name "${expected}"`);
  }

  return category;
}
