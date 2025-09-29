'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  Plus, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Calendar, 
  Clock, 
  Tag, 
  Edit, 
  Trash2, 
  Target,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'

interface TodoItem {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  dueDate?: Date
  createdAt: Date
  updatedAt: Date
  tags: string[]
  estimatedTime?: number // in minutes
  actualTime?: number // in minutes
}

interface TodoListProps {
  todos: TodoItem[]
  onTodosChange: (todos: TodoItem[]) => void
  categories: string[]
  allTags: string[]
}

const PRIORITY_COLORS = {
  low: 'text-green-600',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600'
}

const PRIORITY_ICONS = {
  low: '🟢',
  medium: '🔵',
  high: '🟠',
  urgent: '🔴'
}

export function TodoList({ todos, onTodosChange, categories, allTags }: TodoListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'created' | 'due' | 'priority' | 'title'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: categories[0] || 'General',
    tags: [] as string[],
    estimatedTime: 30,
    dueDate: undefined as Date | undefined
  })
  const [newCategory, setNewCategory] = useState('')
  const [newTag, setNewTag] = useState('')

  const filteredAndSortedTodos = useMemo(() => {
    let filtered = todos

    // Apply filters
    if (filter === 'active') filtered = filtered.filter(t => !t.completed)
    if (filter === 'completed') filtered = filtered.filter(t => t.completed)
    if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter)
    if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter)

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'due':
          if (!a.dueDate && !b.dueDate) comparison = 0
          else if (!a.dueDate) comparison = 1
          else if (!b.dueDate) comparison = -1
          else comparison = a.dueDate.getTime() - b.dueDate.getTime()
          break
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [todos, filter, categoryFilter, priorityFilter, sortBy, sortOrder])

  const addTodo = () => {
    if (!newTodo.title?.trim()) return
    const now = new Date();
    const todo: TodoItem = {
      id: `todo-${Date.now()}`,
      title: newTodo.title,
      description: newTodo.description,
      completed: false,
      priority: newTodo.priority || 'medium',
      category: newTodo.category || 'General',
      dueDate: newTodo.dueDate,
      createdAt: now,
      updatedAt: now,
      tags: newTodo.tags || [],
      estimatedTime: newTodo.estimatedTime
    }

    onTodosChange([...todos, todo])
    setNewTodo({
      title: '',
      description: '',
      priority: 'medium',
      category: categories[0] || 'General',
      tags: [],
      estimatedTime: 30,
      dueDate: undefined
    })
    setIsAddDialogOpen(false)
  }

  const updateTodo = (id: string, updates: Partial<TodoItem>) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, ...updates, updatedAt: new Date() } : todo
    )
    onTodosChange(updatedTodos)
  }

  const deleteTodo = (id: string) => {
    onTodosChange(todos.filter(todo => todo.id !== id))
  }

  const toggleTodo = (id: string) => {
    updateTodo(id, { completed: !todos.find(t => t.id === id)?.completed })
  }

  const addTag = (tag: string) => {
    if (!newTodo.tags?.includes(tag)) {
      setNewTodo(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setNewTodo(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }))
  }

  const addNewTag = () => {
    if (newTag && !allTags.includes(newTag)) {
      // In a real app, you'd update the allTags list here
      addTag(newTag)
      setNewTag('')
    }
  }

  const addNewCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      // In a real app, you'd update the categories list here
      setNewTodo(prev => ({ ...prev, category: newCategory }))
      setNewCategory('')
    }
  }

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1)
  }

  const getDueDateStatus = (dueDate?: Date) => {
    if (!dueDate) return null
    
    const now = new Date()
    const diff = dueDate.getTime() - now.getTime()
    const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 0) return { status: 'overdue', label: 'Overdue', color: 'text-red-600' }
    if (daysDiff === 0) return { status: 'today', label: 'Due today', color: 'text-orange-600' }
    if (daysDiff <= 3) return { status: 'soon', label: `Due in ${daysDiff} days`, color: 'text-yellow-600' }
    return { status: 'future', label: `Due in ${daysDiff} days`, color: 'text-green-600' }
  }

  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length,
    overdue: todos.filter(t => {
      if (t.completed || !t.dueDate) return false
      return new Date() > t.dueDate
    }).length
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="due">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>

            <Button onClick={() => setIsAddDialogOpen(true)} className="ml-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Todo List */}
      <div className="space-y-2">
        {filteredAndSortedTodos.map(todo => {
          const dueStatus = getDueDateStatus(todo.dueDate)
          
          return (
            <Card key={todo.id} className={cn(
              "transition-all duration-200",
              todo.completed && "opacity-60 bg-muted/50"
            )}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-medium",
                          todo.completed && "line-through text-muted-foreground"
                        )}>
                          {todo.title}
                        </h3>
                        {todo.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {todo.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", PRIORITY_COLORS[todo.priority])}
                        >
                          {PRIORITY_ICONS[todo.priority]}
                          {getPriorityLabel(todo.priority)}
                        </Badge>
                        
                        {todo.category && (
                          <Badge variant="secondary" className="text-xs">
                            {todo.category}
                          </Badge>
                        )}
                        
                        {dueStatus && (
                          <Badge variant="outline" className={cn("text-xs", dueStatus.color)}>
                            <Calendar className="h-3 w-3 mr-1" />
                            {dueStatus.label}
                          </Badge>
                        )}
                        
                        {todo.estimatedTime && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {todo.estimatedTime}m
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {todo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {todo.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTodo(todo)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTodo(todo.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        
        {filteredAndSortedTodos.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No todos found</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add your first todo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Todo Dialog */}
      <Dialog open={isAddDialogOpen || !!editingTodo} onOpenChange={() => {
        setIsAddDialogOpen(false)
        setEditingTodo(null)
        setNewTodo({
          title: '',
          description: '',
          priority: 'medium',
          category: categories[0] || 'General',
          tags: [],
          estimatedTime: 30,
          dueDate: undefined
        })
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTodo ? 'Edit Todo' : 'Add New Todo'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={editingTodo?.title || newTodo.title}
                  onChange={(e) => {
                    if (editingTodo) {
                      setEditingTodo({ ...editingTodo, title: e.target.value })
                    } else {
                      setNewTodo({ ...newTodo, title: e.target.value })
                    }
                  }}
                  placeholder="What needs to be done?"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={editingTodo?.priority || newTodo.priority} 
                  onValueChange={(value) => {
                    if (editingTodo) {
                      setEditingTodo({ ...editingTodo, priority: value as any })
                    } else {
                      setNewTodo({ ...newTodo, priority: value as any })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex gap-2">
                  <Select 
                    value={editingTodo?.category || newTodo.category} 
                    onValueChange={(value) => {
                      if (editingTodo) {
                        setEditingTodo({ ...editingTodo, category: value })
                      } else {
                        setNewTodo({ ...newTodo, category: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const category = prompt('Enter new category name:')
                      if (category && !categories.includes(category)) {
                        // In a real app, you'd update the categories list here
                        if (editingTodo) {
                          setEditingTodo({ ...editingTodo, category })
                        } else {
                          setNewTodo({ ...newTodo, category })
                        }
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal w-full">
                      <Calendar className="mr-2 h-4 w-4" />
                      {(editingTodo?.dueDate || newTodo.dueDate) ? 
                        format(editingTodo?.dueDate || newTodo.dueDate!, 'PPP') : 
                        'Pick a date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={editingTodo?.dueDate || newTodo.dueDate}
                      onSelect={(date) => {
                        if (editingTodo) {
                          setEditingTodo({ ...editingTodo, dueDate: date })
                        } else {
                          setNewTodo({ ...newTodo, dueDate: date })
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Time (minutes)</Label>
                <Input
                  type="number"
                  value={editingTodo?.estimatedTime || newTodo.estimatedTime}
                  onChange={(e) => {
                    if (editingTodo) {
                      setEditingTodo({ ...editingTodo, estimatedTime: parseInt(e.target.value) })
                    } else {
                      setNewTodo({ ...newTodo, estimatedTime: parseInt(e.target.value) })
                    }
                  }}
                  min={1}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editingTodo?.description || newTodo.description}
                onChange={(e) => {
                  if (editingTodo) {
                    setEditingTodo({ ...editingTodo, description: e.target.value })
                  } else {
                    setNewTodo({ ...newTodo, description: e.target.value })
                  }
                }}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(editingTodo?.tags || newTodo.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => {
                        if (editingTodo) {
                          setEditingTodo({ ...editingTodo, tags: editingTodo.tags.filter(t => t !== tag) })
                        } else {
                          removeTag(tag)
                        }
                      }}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add new tag"
                  onKeyPress={(e) => e.key === 'Enter' && addNewTag()}
                />
                <Button onClick={addNewTag} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {allTags.filter(tag => !(editingTodo?.tags || newTodo.tags || []).includes(tag)).slice(0, 10).map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => {
                      if (editingTodo) {
                        setEditingTodo({ ...editingTodo, tags: [...editingTodo.tags, tag] })
                      } else {
                        addTag(tag)
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false)
              setEditingTodo(null)
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (editingTodo) {
                updateTodo(editingTodo.id, editingTodo)
                setEditingTodo(null)
              } else {
                addTodo()
              }
            }}>
              {editingTodo ? 'Update Todo' : 'Add Todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
