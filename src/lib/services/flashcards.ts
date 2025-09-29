import { supabase } from '../supabaseClient'
import type { FlashcardDeck, Flashcard } from '../supabase'

export class FlashcardService {

  // Deck operations
  async createDeck(deck: Omit<FlashcardDeck, 'id' | 'created_at' | 'updated_at' | 'cards_count'>) {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .insert({ ...deck, cards_count: 0 })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getUserDecks(userId: string) {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data
  }

  async getDeck(deckId: string) {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .select('*')
      .eq('id', deckId)
      .single()

    if (error) throw error
    return data
  }

  async updateDeck(deckId: string, updates: Partial<FlashcardDeck>) {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', deckId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteDeck(deckId: string) {
    // First delete all cards in the deck
    await supabase
      .from('flashcards')
      .delete()
      .eq('deck_id', deckId)

    // Then delete the deck
    const { error } = await supabase
      .from('flashcard_decks')
      .delete()
      .eq('id', deckId)

    if (error) throw error
  }

  // Card operations
  async createCard(card: Omit<Flashcard, 'id' | 'created_at' | 'updated_at' | 'repetitions' | 'last_reviewed' | 'next_review'>) {
    const { data, error } = await supabase
      .from('flashcards')
      .insert({ 
        ...card, 
        repetitions: 0,
        next_review: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Update deck card count
    await this.updateDeckCardCount(card.deck_id)

    return data
  }

  async getCardsInDeck(deckId: string) {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  }

  async updateCard(cardId: string, updates: Partial<Flashcard>) {
    const { data, error } = await supabase
      .from('flashcards')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteCard(cardId: string) {
    // Get the deck_id before deleting
    const { data: card } = await supabase
      .from('flashcards')
      .select('deck_id')
      .eq('id', cardId)
      .single()

    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', cardId)

    if (error) throw error

    // Update deck card count
    if (card) {
      await this.updateDeckCardCount(card.deck_id)
    }
  }

  // Review operations
  async markCardReviewed(cardId: string, difficulty: 'easy' | 'medium' | 'hard') {
    const now = new Date()
    let nextReviewDate = new Date(now)

    // Simple spaced repetition algorithm
    switch (difficulty) {
      case 'easy':
        nextReviewDate.setDate(now.getDate() + 3)
        break
      case 'medium':
        nextReviewDate.setDate(now.getDate() + 1)
        break
      case 'hard':
        nextReviewDate.setHours(now.getHours() + 1)
        break
    }

    const { data, error } = await supabase
      .from('flashcards')
      .update({
        last_reviewed: now.toISOString(),
        next_review: nextReviewDate.toISOString(),
        repetitions: (undefined as any),
        difficulty,
        updated_at: now.toISOString()
      })
      .eq('id', cardId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getCardsForReview(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('flashcards')
      .select(`
        *,
        flashcard_decks!inner(user_id)
      `)
      .eq('flashcard_decks.user_id', userId)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data
  }

  // Helper function to update deck card count
  private async updateDeckCardCount(deckId: string) {
    const { count } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact' })
      .eq('deck_id', deckId)

    await supabase
      .from('flashcard_decks')
      .update({ 
        cards_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', deckId)
  }
}

export const flashcardService = new FlashcardService()
