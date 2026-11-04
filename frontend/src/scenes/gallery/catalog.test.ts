import { describe, expect, it } from 'vitest'
import { createGalleryEventMemories, GALLERY_EVENT_ORDER } from './catalog'

describe('gallery event catalogue', () => {
  it('keeps the brief order explicit and stable', () => {
    expect(GALLERY_EVENT_ORDER).toEqual([
      '2024_00_Dimas_Birthday',
      '2025_01_Moscow_City_New_Year',
      '2026_01_Country_House_New_Year',
      '2026_02_My_Birthday',
      '2026_02_23_February_23',
      '2026_00_After_Gym',
      '2026_00_Movie_Night',
      '2026_04_Theater_Night',
      '2026_04_Artems_Birthday',
      '2026_05_Annas_Graduation',
      '2026_05_Tula_Trip',
      '2026_05_Tula_Karting',
      '2026_06_Visiting_Anna',
      '2026_00_World_Cup',
      '2026_00_Club_Night',
      '2026_08_Asia_Trip',
      '2026_08_Koh_Samui',
      '2026_00_Timurs_Farewell',
      '2026_09_Annas_Birthday',
      '2026_10_Saint_Petersburg',
      '2026_10_Planetarium',
    ])
  })

  it('uses natural filename order for unnumbered photos and caps each event at four', () => {
    const [memory] = createGalleryEventMemories(
      ['2026_00_Movie_Night'],
      {
        '../../../../images/2026_00_Movie_Night/photo_10.jpg': 'ten',
        '../../../../images/2026_00_Movie_Night/photo_2.jpg': 'two',
        '../../../../images/2026_00_Movie_Night/photo_1.jpg': 'one',
        '../../../../images/2026_00_Movie_Night/photo_3.jpg': 'three',
        '../../../../images/2026_00_Movie_Night/photo_4.jpg': 'four',
        '../../../../images/2026_00_Movie_Night/photo_5.jpg': 'five',
      },
      {},
      [['#100000', '#200000']],
    )

    expect(memory?.images).toEqual(['one', 'two', 'three', 'four'])
    expect(memory?.image).toBe('one')
  })

  it('compacts missing and empty events but retains marked folders as photo placeholders', () => {
    const memories = createGalleryEventMemories(
      [
        '2025_01_Moscow_City_New_Year',
        '2026_01_Country_House_New_Year',
        '2026_08_Asia_Trip',
        '2024_00_Dimas_Birthday',
      ],
      {
        '../../../../images/2024_00_Dimas_Birthday/1.jpg': 'dimas-photo',
        '../../../../images/2026_08_Asia_Trip/video.mp4': 'video-file',
      },
      { '2024_00_Dimas_Birthday': { caption: 'Birthday memory' } },
      [['#100000', '#200000']],
      ['2026_01_Country_House_New_Year'],
    )

    expect(memories.map(({ id }) => id)).toEqual([
      '2026_01_Country_House_New_Year',
      '2024_00_Dimas_Birthday',
    ])
    expect(memories.map(({ side, order }) => [side, order])).toEqual([[-1, 0], [1, 1]])
    expect(memories[0]?.image).toBeUndefined()
    expect(memories[1]?.image).toBe('dimas-photo')
    expect(memories[1]?.caption).toBe('Birthday memory')
  })

  it('adds newly available listed events in order and looks up captions by event ID', () => {
    const newEventId = '2025_01_Moscow_City_New_Year'
    const memories = createGalleryEventMemories(
      GALLERY_EVENT_ORDER,
      {
        '../../../../images/2024_00_Dimas_Birthday/1.jpg': 'dimas-photo',
        [`../../../../images/${newEventId}/1.jpg`]: 'moscow-photo',
        '../../../../images/2026_00_Movie_Night/1.jpg': 'movie-photo',
      },
      {
        [newEventId]: { caption: 'New year in Moscow' },
        '2026_00_Movie_Night': { caption: '' },
      },
      [['#100000', '#200000']],
    )

    expect(memories.map(({ id }) => id)).toEqual([
      '2024_00_Dimas_Birthday',
      newEventId,
      '2026_00_Movie_Night',
    ])
    expect(memories.map(({ side, order }) => [side, order])).toEqual([
      [-1, 0],
      [1, 1],
      [-1, 2],
    ])
    expect(memories.map(({ caption }) => caption)).toEqual([
      '',
      'New year in Moscow',
      '',
    ])
  })

  it('promotes the earliest numbered photo to the main slot when photo 1 is absent', () => {
    const [memory] = createGalleryEventMemories(
      ['2026_00_Movie_Night'],
      {
        '../../../../images/2026_00_Movie_Night/2.jpg': 'two',
        '../../../../images/2026_00_Movie_Night/4.webp': 'four',
      },
      {},
      [['#100000', '#200000']],
    )

    expect(memory?.image).toBe('two')
    expect(memory?.images).toEqual(['two', undefined, undefined, 'four'])
  })
})
