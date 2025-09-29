
export type FileOrFolder = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  items?: FileOrFolder[];
  content?: string; // For text notes or CSV content
  url?: string; // Blob URL for uploads
  mime?: string; // MIME type
  color?: string; // Optional color for folders (e.g., tailwind color hex)
};

export let mockBankData: FileOrFolder[] = [
  {
    id: 'home',
    name: 'Home',
    type: 'folder',
    items: [
      { id: 'folder-1', name: 'Lecture Notes', type: 'folder', items: [
        { id: 'file-1-1', name: 'Week 1 - Intro.pdf', type: 'file' },
        { id: 'file-1-2', name: 'Week 2 - Kinematics.pdf', type: 'file' },
      ]},
      { id: 'folder-2', name: 'Old Exams', type: 'folder', items: [
        { id: 'file-2-1', name: 'Midterm 2023.pdf', type: 'file' },
      ]},
      { id: 'file-3', name: 'Textbook.pdf', type: 'file' },
      { id: 'file-4', name: 'Formula Sheet.docx', type: 'file' },
    ]
  }
];

export const updateBankData = (newData: FileOrFolder[]) => {
  mockBankData.length = 0;
  mockBankData.push(...newData);
};

export function findAndMutate(items: FileOrFolder[], itemId: string, operation: (arr: FileOrFolder[], index: number) => FileOrFolder[]): FileOrFolder[] {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      return operation(items, i);
    }
    if (items[i].type === 'folder' && items[i].items) {
      const newSubItems = findAndMutate(items[i].items!, itemId, operation);
      if (newSubItems !== items[i].items) {
        const newItems = [...items];
        newItems[i] = { ...newItems[i], items: newSubItems };
        return newItems;
      }
    }
  }
  return items;
}

export function addFileToRoot(items: FileOrFolder[], newFile: FileOrFolder): FileOrFolder[] {
    return [newFile, ...items];
}
